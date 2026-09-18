// controllers/dotationController.js
'use strict';

const db = require('../database/database');

// ─── Constantes ───────────────────────────────────────────────────────────────

const VALID_STATUTS        = ['en_cours', 'active', 'returned', 'cloturee', 'annulee'];
const VALID_ITEM_STATUTS   = ['assigné', 'retourné', 'perdu', 'détruit'];
const TERMINAL_STATUTS     = new Set(['returned', 'cloturee', 'annulee']);

const DOTATION_COLUMNS = [
  'code', 'dotation_type', 'beneficiary_type',
  'vdp_id', 'entite_id', 'sous_entite_id', 'coordination_id',
  'source_id', 'statut',
  'date_dotation', 'date_prevue_retour', 'date_cloture', 'observation',
  // Phase 1 — traçabilité magasin
  'magasin_source_id', 'created_by', 'validated_by', 'validated_at',
];

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const normalizeResourceType = (value) => {
  const raw = (value ?? '').toString().trim().toLowerCase();
  if (raw === 'arme'  || raw === 'armes')  return 'arme';
  if (raw === 'optique' || raw === 'optiques') return 'optique';
  if (raw === 'materiel' || raw === 'materiel_specifique' || raw === 'materiels_specifiques') return 'materiel_specifique';
  if (raw === 'munition' || raw === 'munitions') return 'munition';
  return raw || null;
};

const pickPayload = (body = {}, columns = DOTATION_COLUMNS) => {
  const out = {};
  columns.forEach((col) => { if (body[col] !== undefined) out[col] = body[col]; });
  return out;
};

// ─── Audit / historique ───────────────────────────────────────────────────────

const logAudit = async ({ actorId, action, dotationId, before, after }) => {
  try {
    await db.run(
      `INSERT INTO audit_logs (user_id, table_name, record_id, action, details, resource)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorId  || null,
        'dotations',
        dotationId || null,
        action,
        JSON.stringify({ before: before || null, after: after || null }),
        'dotations',
      ]
    );
  } catch (err) {
    console.warn('[dotationController] audit failure:', err.message);
  }
};

const logHistory = async ({ dotationId, action, actorId, oldVdpId, newVdpId, oldEntiteId, newEntiteId, details }) => {
  try {
    await db.run(
      `INSERT INTO dotation_history
         (dotation_id, action, old_vdp_id, new_vdp_id, old_entite_id, new_entite_id, details, date_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [dotationId, action, oldVdpId || null, newVdpId || null, oldEntiteId || null, newEntiteId || null, details || null]
    );
  } catch (err) {
    console.warn('[dotationController] history failure:', err.message);
  }
};

// ─── Journal dotation_logs ────────────────────────────────────────────────────

const logDotationAction = async ({ dotationId, typeAction, actorId, actorNom, actorRole, magasinId, details }) => {
  try {
    await db.run(
      `INSERT INTO dotation_logs
         (dotation_id, type_action, acteur_id, acteur_nom, acteur_role, magasin_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dotationId   || null,
        typeAction,
        actorId      || null,
        actorNom     || null,
        actorRole    || null,
        magasinId    || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    console.warn('[dotationController] logDotationAction failure:', err.message);
  }
};

// ─── Chain of custody ─────────────────────────────────────────────────────────

const openCustody = async ({ resourceType, resourceId, holderType, holderId, justificatif }) => {
  // Ferme toute garde ouverte sur cette ressource
  await db.run(
    `UPDATE chain_of_custody
     SET ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE ressource_type = ? AND ressource_id = ? AND ended_at IS NULL AND deleted_at IS NULL`,
    [resourceType, resourceId]
  );
  await db.run(
    `INSERT INTO chain_of_custody (ressource_type, ressource_id, holder_type, holder_id, justificatif)
     VALUES (?, ?, ?, ?, ?)`,
    [resourceType, resourceId, holderType, holderId, justificatif || null]
  );
};

const closeCustody = async ({ resourceType, resourceId }) => {
  await db.run(
    `UPDATE chain_of_custody
     SET ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE ressource_type = ? AND ressource_id = ? AND ended_at IS NULL AND deleted_at IS NULL`,
    [resourceType, resourceId]
  );
};

// ─── Contrôle disponibilité des ressources ────────────────────────────────────

/**
 * Vérifie que chaque ressource n'est pas déjà active dans une autre dotation.
 * Les munitions sont exclues (quantité consommable, distribution multiple autorisée).
 * Retourne un tableau de conflits (vide si tout est libre).
 */
const checkAvailability = async (items = [], excludeDotationId = null) => {
  const conflicts = [];
  for (const item of items) {
    const rt  = normalizeResourceType(item.resource_type);
    const rid = item.resource_id;
    if (!rt || !rid || rt === 'munition') continue;

    let sql = `
      SELECT d.id, d.code, d.statut, d.vdp_id, d.entite_id
      FROM dotation_items di
      JOIN dotations d ON d.id = di.dotation_id
      WHERE di.resource_type = ?
        AND di.resource_id   = ?
        AND di.status        = 'assigné'
        AND di.deleted_at    IS NULL
        AND d.deleted_at     IS NULL
        AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
    `;
    const params = [rt, rid];
    if (excludeDotationId) { sql += ' AND d.id != ?'; params.push(excludeDotationId); }

    const conflict = await db.get(sql, params);
    if (conflict) conflicts.push({ resource_type: rt, resource_id: rid, existing_dotation: conflict });
  }
  return conflicts;
};

// ─── Gestion balance munitions ────────────────────────────────────────────────

const decrementMunition = async ({ configMunitionId, quantite, dotationId }) => {
  await db.run(
    `UPDATE munitions
     SET total_sorties = total_sorties + ?,
         balance       = balance - ?,
         updated_at    = CURRENT_TIMESTAMP
     WHERE config_munition_id = ?`,
    [quantite, quantite, configMunitionId]
  );
  await db.run(
    `INSERT INTO transactions_munitions (config_munition_id, type_operation, quantite, code)
     VALUES (?, 'DOTATION', ?, ?)`,
    [configMunitionId, quantite, `DOT-${dotationId}`]
  );
};

const incrementMunition = async ({ configMunitionId, quantite, dotationId }) => {
  await db.run(
    `UPDATE munitions
     SET total_entrees = total_entrees + ?,
         balance       = balance + ?,
         updated_at    = CURRENT_TIMESTAMP
     WHERE config_munition_id = ?`,
    [quantite, quantite, configMunitionId]
  );
  await db.run(
    `INSERT INTO transactions_munitions (config_munition_id, type_operation, quantite, code)
     VALUES (?, 'ENTREE', ?, ?)`,
    [configMunitionId, quantite, `RET-${dotationId}`]
  );
};

// ─── Mise à jour état des ressources ─────────────────────────────────────────

const markAssigned = async (resourceType, resourceId, dotationType = 'individuelle') => {
  const statut = dotationType === 'collective' ? 'dotee_collectif' : 'dotee';
  if (resourceType === 'arme') {
    await db.run(
      `UPDATE armes SET etat = 'en_dotation', statut = ?, magasin_id = NULL,
       date_sortie = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [statut, resourceId]
    );
  } else if (resourceType === 'optique') {
    await db.run(
      `UPDATE optiques SET etat = 'en_dotation', date_sortie = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [resourceId]
    );
  } else if (resourceType === 'materiel_specifique') {
    await db.run(
      `UPDATE materiels_specifiques SET etat = 'en_dotation', date_sortie = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [resourceId]
    );
  }
};

const markReturned = async (resourceType, resourceId, magasinId = null) => {
  if (resourceType === 'arme') {
    await db.run(
      `UPDATE armes SET etat = 'disponible', statut = ?, magasin_id = ?,
       date_sortie = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [magasinId ? 'en_stock' : 'disponible', magasinId || null, resourceId]
    );
  } else if (resourceType === 'optique') {
    await db.run(
      `UPDATE optiques SET etat = 'disponible', date_sortie = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [resourceId]
    );
  } else if (resourceType === 'materiel_specifique') {
    await db.run(
      `UPDATE materiels_specifiques SET etat = 'disponible', date_sortie = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [resourceId]
    );
  }
};

// ─── Items helpers ────────────────────────────────────────────────────────────

const replaceItems = async (dotationId, items = [], actorId = null) => {
  await db.run(`DELETE FROM dotation_items WHERE dotation_id = ?`, [dotationId]);
  for (const item of items) {
    if (!item?.resource_id) continue;
    const rt = normalizeResourceType(item.resource_type) || 'arme';
    await db.run(
      `INSERT INTO dotation_items
         (dotation_id, resource_type, resource_id, quantite, status, condition_initiale,
          created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        dotationId, rt, item.resource_id,
        item.quantite ?? 1,
        item.status || 'assigné',
        item.condition_initiale || null,
        actorId, actorId,
      ]
    );
  }
};

// ─── Lecture complète avec jointures ─────────────────────────────────────────

const fetchOne = async (id) => {
  const dotation = await db.get(
    `SELECT d.*,
       v.nom AS vdp_nom, v.prenom AS vdp_prenom, v.numero_cnib AS vdp_cnib,
       e.nom  AS entite_nom,  e.code AS entite_code,
       se.nom AS sous_entite_nom,
       c.nom  AS coordination_nom
     FROM dotations d
     LEFT JOIN vdp          v  ON v.id  = d.vdp_id
     LEFT JOIN entites      e  ON e.id  = d.entite_id
     LEFT JOIN sous_entites se ON se.id = d.sous_entite_id
     LEFT JOIN coordinations c ON c.id  = d.coordination_id
     WHERE d.id = ? AND d.deleted_at IS NULL`,
    [id]
  );
  if (!dotation) return null;

  const items = await db.all(
    `SELECT di.*,
       -- Arme
       arm.numero_serie  AS arme_numero_serie,
       arm.etat          AS arme_etat,
       ca.designation    AS arme_designation,
       ca.type           AS arme_type,
       -- Optique
       opt.numero_serie  AS optique_numero_serie,
       opt.etat          AS optique_etat,
       co.designation    AS optique_designation,
       co.type           AS optique_type,
       -- Matériel spécifique
       ms.numero_serie   AS materiel_numero_serie,
       ms.etat           AS materiel_etat,
       cmt.designation   AS materiel_designation,
       cmt.type          AS materiel_type,
       -- Munition
       cm.designation    AS munition_designation,
       cm.calibre        AS munition_calibre,
       cm.code           AS munition_code
     FROM dotation_items di
     LEFT JOIN armes              arm ON di.resource_type = 'arme'               AND di.resource_id = arm.id
     LEFT JOIN config_arme        ca  ON arm.config_arme_id = ca.id
     LEFT JOIN optiques           opt ON di.resource_type = 'optique'            AND di.resource_id = opt.id
     LEFT JOIN config_optique     co  ON opt.config_optique_id = co.id
     LEFT JOIN materiels_specifiques ms  ON di.resource_type = 'materiel_specifique' AND di.resource_id = ms.id
     LEFT JOIN config_materiel    cmt ON ms.config_materiel_id = cmt.id
     LEFT JOIN config_munition    cm  ON di.resource_type = 'munition'           AND di.resource_id = cm.id
     WHERE di.dotation_id = ? AND di.deleted_at IS NULL
     ORDER BY di.id ASC`,
    [id]
  );

  dotation.items          = items || [];
  dotation.armes_count    = items.filter((i) => i.resource_type === 'arme').length;
  dotation.optiques_count = items.filter((i) => i.resource_type === 'optique').length;
  dotation.materiels_count = items.filter((i) => i.resource_type === 'materiel_specifique').length;
  dotation.munitions_quantite = items
    .filter((i) => i.resource_type === 'munition')
    .reduce((s, i) => s + (Number(i.quantite) || 0), 0);

  return dotation;
};

// ─── Détermination du holder pour chain_of_custody ───────────────────────────

const resolveHolder = (body) => {
  if (body.vdp_id)         return { holderType: 'vdp',          holderId: body.vdp_id };
  if (body.coordination_id) return { holderType: 'coordination', holderId: body.coordination_id };
  if (body.sous_entite_id)  return { holderType: 'sous_entite',  holderId: body.sous_entite_id };
  if (body.entite_id)       return { holderType: 'entite',       holderId: body.entite_id };
  return { holderType: null, holderId: null };
};

// ─── Normalisation des items de la requête ────────────────────────────────────

const normalizeItems = (rawItems = []) =>
  rawItems
    .filter((i) => i && i.resource_id)
    .map((i) => ({
      ...i,
      resource_type: normalizeResourceType(i.resource_type || i.ressource_type) || 'arme',
      resource_id:   i.resource_id ?? i.ressource_id ?? i.arme_id ?? null,
      quantite:      i.quantite ?? i.quantity ?? 1,
      status:        i.status || i.statut || 'assigné',
    }));

// ═══════════════════════════════════════════════════════════════════════════════
// Module exports — API publique du controller
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {

  // ── Lecture unique ──────────────────────────────────────────────────────────

  async get({ id }) {
    return fetchOne(id);
  },

  // ── Liste paginée avec filtres ──────────────────────────────────────────────

  async list({ listOpts = {}, filters = {}, scope = {} } = {}) {
    const { limit = 200, offset = 0, sortBy, sortDir, search } = listOpts;

    const clauses = ['d.deleted_at IS NULL'];
    const params  = [];

    if (filters.beneficiary_type) { clauses.push('d.beneficiary_type = ?'); params.push(filters.beneficiary_type); }
    if (filters.dotation_type)    { clauses.push('d.dotation_type = ?');    params.push(filters.dotation_type); }
    if (filters.statut)           { clauses.push('d.statut = ?');           params.push(filters.statut); }
    if (filters.vdp_id)           { clauses.push('d.vdp_id = ?');           params.push(filters.vdp_id); }
    if (filters.entite_id)        { clauses.push('d.entite_id = ?');        params.push(filters.entite_id); }
    if (filters.coordination_id)  { clauses.push('d.coordination_id = ?'); params.push(filters.coordination_id); }

    if (filters.resource_type) {
      const rt = normalizeResourceType(filters.resource_type);
      clauses.push(
        `EXISTS (
           SELECT 1 FROM dotation_items di2
           WHERE di2.dotation_id = d.id AND di2.deleted_at IS NULL AND di2.resource_type = ?
         )`
      );
      params.push(rt);
    }

    // Contraintes de scope organisationnel
    if (scope.entite_id != null) {
      clauses.push('(d.entite_id = ? OR v.entite_id = ?)');
      params.push(scope.entite_id, scope.entite_id);
    }
    if (scope.sous_entite_id != null) {
      clauses.push('(d.sous_entite_id = ? OR v.sous_entite_id = ?)');
      params.push(scope.sous_entite_id, scope.sous_entite_id);
    }

    if (search?.q) {
      const like = `%${search.q}%`;
      clauses.push(`(
        COALESCE(d.code,'')        LIKE ? OR
        COALESCE(v.nom,'')         LIKE ? OR COALESCE(v.prenom,'') LIKE ? OR
        COALESCE(e.nom,'')         LIKE ? OR COALESCE(se.nom,'')   LIKE ? OR
        COALESCE(arm.numero_serie,'') LIKE ? OR
        COALESCE(opt.numero_serie,'') LIKE ? OR
        COALESCE(ms.numero_serie,'')  LIKE ? OR
        COALESCE(cm.designation,'')   LIKE ?
      )`);
      params.push(...Array(9).fill(like));
    }

    const where = `WHERE ${clauses.join(' AND ')}`;

    const orderMap = {
      code: 'd.code', date_dotation: 'd.date_dotation', statut: 'd.statut',
      dotation_type: 'd.dotation_type', beneficiary_type: 'd.beneficiary_type',
      created_at: 'd.created_at',
    };
    const orderCol = orderMap[sortBy] || 'd.date_dotation';
    const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const baseSql = `
      FROM dotations d
      LEFT JOIN vdp          v   ON v.id  = d.vdp_id
      LEFT JOIN entites      e   ON e.id  = d.entite_id
      LEFT JOIN sous_entites se  ON se.id = d.sous_entite_id
      LEFT JOIN coordinations cc ON cc.id = d.coordination_id
      LEFT JOIN dotation_items di  ON di.dotation_id = d.id AND di.deleted_at IS NULL
      LEFT JOIN armes              arm ON di.resource_type = 'arme'               AND di.resource_id = arm.id
      LEFT JOIN optiques           opt ON di.resource_type = 'optique'            AND di.resource_id = opt.id
      LEFT JOIN materiels_specifiques ms  ON di.resource_type = 'materiel_specifique' AND di.resource_id = ms.id
      LEFT JOIN config_munition    cm  ON di.resource_type = 'munition'           AND di.resource_id = cm.id
      ${where}
    `;

    const rows = await db.all(
      `SELECT
         d.id, d.code, d.dotation_type, d.beneficiary_type, d.statut,
         d.vdp_id, d.entite_id, d.sous_entite_id, d.coordination_id,
         d.date_dotation, d.date_prevue_retour, d.date_cloture, d.observation,
         d.created_at, d.updated_at,
         v.nom  AS vdp_nom,  v.prenom AS vdp_prenom,
         e.nom  AS entite_nom, e.code AS entite_code,
         se.nom AS sous_entite_nom,
         cc.nom AS coordination_nom,
         COUNT(DISTINCT CASE WHEN di.id IS NOT NULL THEN di.id END) AS items_count,
         COUNT(DISTINCT CASE WHEN di.resource_type = 'arme'               THEN di.id END) AS armes_count,
         COUNT(DISTINCT CASE WHEN di.resource_type = 'optique'            THEN di.id END) AS optiques_count,
         COUNT(DISTINCT CASE WHEN di.resource_type = 'materiel_specifique' THEN di.id END) AS materiels_count,
         COALESCE(SUM(CASE WHEN di.resource_type = 'munition' THEN di.quantite ELSE 0 END), 0) AS munitions_quantite
       ${baseSql}
       GROUP BY d.id, v.nom, v.prenom, e.nom, e.code, se.nom, cc.nom
       ORDER BY ${orderCol} ${orderDir}, d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const countRow = await db.get(
      `SELECT COUNT(DISTINCT d.id) AS cnt ${baseSql}`,
      params
    );

    return { rows: rows || [], total: Number(countRow?.cnt || 0) };
  },

  // ── Création ────────────────────────────────────────────────────────────────

  async add({ body = {}, currentUser } = {}) {
    const actorId = currentUser?.id || null;
    const payload = pickPayload(body);
    payload.statut     = payload.statut || 'en_cours';
    payload.created_by = actorId;
    payload.updated_by = actorId;

    const items = normalizeItems(Array.isArray(body.items) ? body.items : []);
    if (!items.length) {
      const err = new Error('DOTATION_ITEMS_REQUIRED');
      err.status = 400;
      throw err;
    }

    const conflicts = await checkAvailability(items);
    if (conflicts.length) {
      const err = new Error('DOTATION_RESOURCE_UNAVAILABLE');
      err.status = 409;
      err.conflicts = conflicts;
      throw err;
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const cols  = Object.keys(payload);
      const vals  = cols.map((c) => payload[c]);
      const result = await db.run(
        `INSERT INTO dotations (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        vals
      );
      const dotationId = result.lastID;

      await replaceItems(dotationId, items, actorId);

      const { holderType, holderId } = resolveHolder(body);
      const dotationType = payload.dotation_type || body.dotation_type || 'individuelle';

      const magasinSourceId = body.magasin_source_id || payload.magasin_source_id || null;

      for (const item of items) {
        const rt  = item.resource_type;
        const rid = item.resource_id;
        if (!rid) continue;

        if (rt === 'munition') {
          await decrementMunition({ configMunitionId: rid, quantite: item.quantite || 1, dotationId });
        } else {
          await markAssigned(rt, rid, dotationType);
          if (holderType && holderId) {
            await openCustody({ resourceType: rt, resourceId: rid, holderType, holderId, justificatif: body.observation });
          }

          // Sortir du stock magasin source si renseigné
          if (magasinSourceId) {
            await db.run(
              `UPDATE stock_magasin
               SET quantite = quantite - ?, updated_at = CURRENT_TIMESTAMP
               WHERE magasin_id = ? AND resource_type = ? AND resource_id = ? AND quantite > 0`,
              [item.quantite || 1, magasinSourceId, rt, rid]
            );
            await db.run(
              `DELETE FROM stock_magasin
               WHERE magasin_id = ? AND resource_type = ? AND resource_id = ? AND quantite <= 0`,
              [magasinSourceId, rt, rid]
            );
            await db.run(
              `INSERT INTO mouvements_magasin
                 (magasin_id, resource_type, resource_id, type, quantite, acteur_id, dotation_id)
               VALUES (?, ?, ?, 'sortie_dotation', ?, ?, ?)`,
              [magasinSourceId, rt, rid, item.quantite || 1, actorId, dotationId]
            );
          }
        }
      }

      await db.run('COMMIT');

      const created = await fetchOne(dotationId);
      await logAudit({ actorId, action: 'CREATE', dotationId, after: created });
      await logHistory({ dotationId, action: 'CREATE', actorId, newVdpId: body.vdp_id, newEntiteId: body.entite_id });

      // Journal dotation_logs
      const acteurRow = actorId ? await db.get(`SELECT nom, prenom FROM utilisateurs WHERE id = ?`, [actorId]) : null;
      await logDotationAction({
        dotationId,
        typeAction:  'creation',
        actorId,
        actorNom:    acteurRow ? `${acteurRow.nom} ${acteurRow.prenom || ''}`.trim() : null,
        magasinId:   magasinSourceId,
        details:     { dotation_type: dotationType, beneficiary_type: payload.beneficiary_type, nb_items: items.length },
      });

      return created;
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  // ── Mise à jour ─────────────────────────────────────────────────────────────

  async update({ id, body = {}, currentUser } = {}) {
    const existing = await fetchOne(id);
    if (!existing) return null;

    const actorId = currentUser?.id || null;
    const payload = pickPayload(body);
    payload.updated_by = actorId;

    try {
      await db.run('BEGIN TRANSACTION');

      if (Object.keys(payload).length) {
        const cols = Object.keys(payload);
        await db.run(
          `UPDATE dotations SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [...cols.map((c) => payload[c]), id]
        );
      }

      if (Array.isArray(body.items)) {
        const items = normalizeItems(body.items);
        const conflicts = await checkAvailability(items, id);
        if (conflicts.length) {
          await db.run('ROLLBACK').catch(() => {});
          const err = new Error('DOTATION_RESOURCE_UNAVAILABLE');
          err.status = 409;
          err.conflicts = conflicts;
          throw err;
        }
        await replaceItems(id, items, actorId);
      }

      await db.run('COMMIT');

      const updated = await fetchOne(id);
      await logAudit({ actorId, action: 'UPDATE', dotationId: id, before: existing, after: updated });
      return updated;
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  // ── Workflow retour ─────────────────────────────────────────────────────────

  async retour({ id, body = {}, currentUser } = {}) {
    const dotation = await fetchOne(id);
    if (!dotation) return null;
    if (TERMINAL_STATUTS.has(dotation.statut)) {
      const err = new Error('DOTATION_ALREADY_CLOSED');
      err.status = 409;
      throw err;
    }

    const actorId       = currentUser?.id || null;
    const retourDetails = Array.isArray(body.items) ? body.items : [];

    try {
      await db.run('BEGIN TRANSACTION');

      for (const item of dotation.items) {
        if (item.status === 'retourné') continue;

        const detail          = retourDetails.find((r) => r.id === item.id) || {};
        const conditionRetour = detail.condition_retour || body.condition_retour || null;

        await db.run(
          `UPDATE dotation_items
           SET status = 'retourné', condition_retour = ?,
               returned_at = CURRENT_TIMESTAMP, returned_by = ?,
               updated_at  = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [conditionRetour, actorId, item.id]
        );

        const rt  = item.resource_type;
        const rid = item.resource_id;

        // magasin de retour (optionnel — VDP peut rendre dans n'importe quel magasin)
        const magasinRetourId = body.magasin_retour_id || null;

        if (rt === 'munition') {
          const qtRetour = Number(detail.quantite_retour ?? 0);
          if (qtRetour > 0) {
            await incrementMunition({ configMunitionId: rid, quantite: qtRetour, dotationId: id });
          }
        } else {
          await markReturned(rt, rid, magasinRetourId);
          await closeCustody({ resourceType: rt, resourceId: rid });

          // Remettre en stock si magasin de retour fourni
          if (magasinRetourId && rt === 'arme') {
            await db.run(`
              INSERT INTO stock_magasin (magasin_id, resource_type, resource_id, quantite)
              VALUES (?, ?, ?, 1)
              ON CONFLICT (magasin_id, resource_type, resource_id)
              DO UPDATE SET quantite = stock_magasin.quantite + 1, updated_at = NOW()
            `, [magasinRetourId, rt, rid]);

            await db.run(`
              INSERT INTO mouvements_magasin
                (magasin_id, type, resource_type, resource_id, quantite, dotation_id, acteur_id, observation)
              VALUES (?, 'retour_vdp', ?, ?, 1, ?, ?, ?)
            `, [magasinRetourId, rt, rid, id, actorId, body.observation || null]);
          }
        }
      }

      await db.run(
        `UPDATE dotations
         SET statut = 'returned', date_cloture = CURRENT_DATE,
             updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [actorId, id]
      );

      await db.run('COMMIT');

      const updated = await fetchOne(id);
      await logAudit({ actorId, action: 'RETOUR', dotationId: id, before: dotation, after: updated });
      await logHistory({
        dotationId: id, action: 'RETOUR', actorId,
        oldVdpId:    dotation.vdp_id,
        oldEntiteId: dotation.entite_id,
        details: body.observation || null,
      });

      // Journal dotation_logs
      const acteurRow2 = actorId ? await db.get(`SELECT nom, prenom FROM utilisateurs WHERE id = ?`, [actorId]) : null;
      await logDotationAction({
        dotationId: id,
        typeAction: 'reintegration_totale',
        actorId,
        actorNom:  acteurRow2 ? `${acteurRow2.nom} ${acteurRow2.prenom || ''}`.trim() : null,
        magasinId: body.magasin_retour_id || null,
        details:   { nb_items: dotation.items.length, observation: body.observation || null },
      });

      return updated;
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  // ── Changement de statut ────────────────────────────────────────────────────

  async changerStatut({ id, statut, currentUser } = {}) {
    if (!VALID_STATUTS.includes(statut)) {
      const err = new Error('DOTATION_INVALID_STATUS');
      err.status = 400;
      throw err;
    }
    const existing = await db.get(
      `SELECT id, statut FROM dotations WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!existing) return null;

    const actorId = currentUser?.id || null;
    await db.run(
      `UPDATE dotations SET statut = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [statut, actorId, id]
    );

    await logAudit({
      actorId, action: 'STATUT_CHANGE', dotationId: id,
      before: { statut: existing.statut }, after: { statut },
    });
    return fetchOne(id);
  },

  // ── Transfert vers un autre bénéficiaire ────────────────────────────────────

  async transferer({ id, body = {}, currentUser } = {}) {
    const dotation = await fetchOne(id);
    if (!dotation) return null;
    if (TERMINAL_STATUTS.has(dotation.statut)) {
      const err = new Error('DOTATION_ALREADY_CLOSED');
      err.status = 409;
      throw err;
    }

    const actorId = currentUser?.id || null;
    const newVdpId    = body.vdp_id    || null;
    const newEntiteId = body.entite_id || null;
    if (!newVdpId && !newEntiteId) {
      const err = new Error('DOTATION_TRANSFER_BENEFICIARY_REQUIRED');
      err.status = 400;
      throw err;
    }

    try {
      await db.run('BEGIN TRANSACTION');

      await db.run(
        `UPDATE dotations
         SET vdp_id = ?, entite_id = ?, sous_entite_id = ?, coordination_id = ?,
             beneficiary_type = ?,
             updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          newVdpId,
          newEntiteId,
          body.sous_entite_id  || null,
          body.coordination_id || null,
          newVdpId ? 'vdp' : 'entite',
          actorId, id,
        ]
      );

      const { holderType, holderId } = resolveHolder(body);
      for (const item of dotation.items) {
        if (item.status !== 'assigné') continue;
        const rt  = item.resource_type;
        const rid = item.resource_id;
        if (rt !== 'munition' && holderType && holderId) {
          await openCustody({ resourceType: rt, resourceId: rid, holderType, holderId, justificatif: body.observation });
        }
      }

      await db.run('COMMIT');

      const updated = await fetchOne(id);
      await logAudit({ actorId, action: 'TRANSFER', dotationId: id, before: dotation, after: updated });
      await logHistory({
        dotationId: id, action: 'TRANSFER', actorId,
        oldVdpId:    dotation.vdp_id,    newVdpId,
        oldEntiteId: dotation.entite_id, newEntiteId,
        details: body.observation || null,
      });

      return updated;
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  // ── Suppression (soft par défaut) ───────────────────────────────────────────

  async del({ id, soft = true, currentUser } = {}) {
    const existing = await fetchOne(id);
    if (!existing) return false;

    // Interdire la suppression si des items sont encore assignés
    if (soft && existing.items?.some((i) => i.status === 'assigné')) {
      const err = new Error('DOTATION_HAS_ASSIGNED_ITEMS');
      err.status = 409;
      throw err;
    }

    const actorId = currentUser?.id || null;

    try {
      await db.run('BEGIN TRANSACTION');

      if (soft) {
        await db.run(
          `UPDATE dotations SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, synced = false WHERE id = ?`,
          [actorId, id]
        );
        await db.run(
          `UPDATE dotation_items SET deleted_at = CURRENT_TIMESTAMP, synced = false WHERE dotation_id = ?`,
          [id]
        );
      } else {
        await db.run(`DELETE FROM dotation_items WHERE dotation_id = ?`, [id]);
        await db.run(`DELETE FROM dotations WHERE id = ?`, [id]);
      }

      await db.run('COMMIT');

      await logAudit({
        actorId, action: soft ? 'SOFT_DELETE' : 'DELETE',
        dotationId: id, before: existing,
      });
      return true;
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  },

  // ── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const [total, parStatut, ressourcesActives, recentes] = await Promise.all([
      db.get(`SELECT COUNT(*) AS cnt FROM dotations WHERE deleted_at IS NULL`),

      db.all(`
        SELECT statut, COUNT(*) AS cnt
        FROM dotations WHERE deleted_at IS NULL
        GROUP BY statut ORDER BY cnt DESC
      `),

      db.all(`
        SELECT
          SUM(CASE WHEN di.resource_type = 'arme'               THEN 1       ELSE 0 END) AS armes,
          SUM(CASE WHEN di.resource_type = 'optique'            THEN 1       ELSE 0 END) AS optiques,
          SUM(CASE WHEN di.resource_type = 'materiel_specifique' THEN 1      ELSE 0 END) AS materiels,
          SUM(CASE WHEN di.resource_type = 'munition'           THEN di.quantite ELSE 0 END) AS munitions
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND di.status = 'assigné'
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      `),

      db.all(`
        SELECT d.id, d.code, d.statut, d.date_dotation, d.dotation_type, d.beneficiary_type,
               v.nom AS vdp_nom, v.prenom AS vdp_prenom, e.nom AS entite_nom
        FROM dotations d
        LEFT JOIN vdp     v ON v.id = d.vdp_id
        LEFT JOIN entites e ON e.id = d.entite_id
        WHERE d.deleted_at IS NULL
        ORDER BY d.created_at DESC LIMIT 10
      `),
    ]);

    return {
      total:              Number(total?.cnt || 0),
      par_statut:         parStatut || [],
      ressources_actives: ressourcesActives?.[0] || { armes: 0, optiques: 0, materiels: 0, munitions: 0 },
      recentes:           recentes || [],
    };
  },
};
