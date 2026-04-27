// controllers/dotationController.js
'use strict';

const db = require('../database/database');

const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';

const RESOURCE_JOINS = `
  LEFT JOIN dotation_items di ON di.dotation_id = d.id AND di.deleted_at IS NULL
  LEFT JOIN armes a ON di.resource_type = 'arme' AND di.resource_id = a.id
  LEFT JOIN optiques o ON di.resource_type = 'optique' AND di.resource_id = o.id
  LEFT JOIN materiels_specifiques ms ON di.resource_type = 'materiel' AND di.resource_id = ms.id
  LEFT JOIN config_munition cm ON di.resource_type = 'munition' AND di.resource_id = cm.id
`;
const AUDIT_RESOURCE = 'dotations';
const DOTATION_COLUMNS = [
  'code',
  'dotation_type',
  'beneficiary_type',
  'vdp_id',
  'entite_id',
  'sous_entite_id',
  'coordination_id',
  'lot_id',
  'source_id',
  'statut',
  'date_dotation',
  'date_prevue_retour',
  'date_cloture',
  'observation'
];
const nowISO = () => new Date().toISOString();
const pickDotationPayload = (payload = {}) => {
  const picked = {};
  DOTATION_COLUMNS.forEach((column) => {
    if (payload[column] !== undefined) picked[column] = payload[column];
  });
  return picked;
};
const logDotationAudit = async ({ actorId, action, dotationId, before, after }) => {
  try {
    await db.run(
      `INSERT INTO audit_logs (user_id, table_name, record_id, action, details, resource)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actorId || null,
        'dotations',
        dotationId || null,
        action,
        JSON.stringify({ before: before || null, after: after || null }),
        AUDIT_RESOURCE
      ]
    );
  } catch (error) {
    console.warn('[dotations] audit log failure:', error.message);
  }
};
const replaceDotationItems = async ({ dotationId, items = [], actorId, timestamp }) => {
  await db.run(`DELETE FROM dotation_items WHERE dotation_id = ?`, [dotationId]);
  if (!items.length) return;
  const now = timestamp || nowISO();
  for (const item of items) {
    const normalized = {
      dotation_id: dotationId,
      resource_type: item.resource_type || (item.arme_id ? 'arme' : 'resource'),
      resource_id: item.resource_id || item.arme_id,
      arme_id: item.arme_id || null,
      quantite: item.quantite || item.quantity || 1,
      status: item.status || 'assigné',
      condition_initiale: item.condition_initiale || null,
      condition_retour: item.condition_retour || null,
      returned_at: item.returned_at || null,
      returned_by: item.returned_by || null,
      created_by: actorId || null,
      updated_by: actorId || null,
      created_at: now,
      updated_at: now,
      synced: 0
    };
    const columns = Object.keys(normalized).filter((key) => normalized[key] !== undefined);
    const placeholders = columns.map(() => '?').join(', ');
    await db.run(
      `INSERT INTO dotation_items (${columns.join(', ')}) VALUES (${placeholders})`,
      columns.map((column) => normalized[column])
    );
  }
};

module.exports = {
  /**
   * Liste globale des dotations (toutes ressources confondues)
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};
    const clauses = [];
    const params = [];
    if (!filters?.includeDeleted) clauses.push('d.deleted_at IS NULL');
    if (filters?.beneficiary_type) {
      clauses.push('d.beneficiary_type = ?');
      params.push(String(filters.beneficiary_type));
    }
    if (filters?.dotation_type) {
      clauses.push('d.dotation_type = ?');
      params.push(String(filters.dotation_type));
    }
    if (filters?.statut) {
      clauses.push('d.statut = ?');
      params.push(String(filters.statut));
    }
    if (filters?.resource_type) {
      clauses.push(`EXISTS (
      SELECT 1 FROM dotation_items di2
      WHERE di2.dotation_id = d.id
        AND di2.deleted_at IS NULL
        AND di2.resource_type = ?
    )`);
      params.push(String(filters.resource_type));
    }
    if (search?.q) {
      const like = `%${search.q}%`;
      clauses.push(`(
      COALESCE(d.code,'') LIKE ?
      OR COALESCE(v.nom,'') LIKE ?
      OR COALESCE(v.prenom,'') LIKE ?
      OR COALESCE(e.nom,'') LIKE ?
      OR COALESCE(se.nom,'') LIKE ?
      OR COALESCE(c.nom,'') LIKE ?
      OR COALESCE(a.numero_serie,'') LIKE ?
      OR COALESCE(o.numero_serie,'') LIKE ?
      OR COALESCE(ms.numero_serie,'') LIKE ?
      OR COALESCE(cm.designation,'') LIKE ?
    )`);
      params.push(...Array(10).fill(like));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const base = `
    FROM dotations d
    LEFT JOIN vdp v ON v.id = d.vdp_id
    LEFT JOIN entites e ON e.id = d.entite_id
    LEFT JOIN sous_entites se ON se.id = d.sous_entite_id
    LEFT JOIN coordinations c ON c.id = d.coordination_id
    ${RESOURCE_JOINS}
    ${where}
  `;
    const select = `
    SELECT
      d.*,
      v.nom AS vdp_nom,
      v.prenom AS vdp_prenom,
      e.nom AS entite_nom,
      e.code AS entite_code,
      se.nom AS sous_entite_nom,
      c.nom AS coordination_nom,
      SUM(CASE WHEN di.id IS NOT NULL THEN 1 ELSE 0 END) AS items_count,
      SUM(CASE WHEN di.resource_type = 'arme' THEN 1 ELSE 0 END) AS armes_count,
      SUM(CASE WHEN di.resource_type = 'optique' THEN 1 ELSE 0 END) AS optiques_count,
      SUM(CASE WHEN di.resource_type = 'materiel' THEN 1 ELSE 0 END) AS materiels_count,
      SUM(CASE WHEN di.resource_type = 'munition' THEN di.quantite ELSE 0 END) AS munitions_quantite,
      GROUP_CONCAT(DISTINCT TRIM(
        CASE di.resource_type
          WHEN 'arme' THEN 'Arme — ' || COALESCE(a.numero_serie, a.designation, 'ID ' || a.id)
          WHEN 'optique' THEN 'Optique — ' || COALESCE(o.numero_serie, o.designation, 'ID ' || o.id)
          WHEN 'materiel' THEN 'Matériel — ' || COALESCE(ms.numero_serie, ms.designation, 'ID ' || ms.id)
          WHEN 'munition' THEN 'Munition — ' || COALESCE(cm.designation, cm.code, 'ID ' || cm.id)
          ELSE 'Ressource'
        END
      ), ' • ') AS resources_summary
    ${base}
    GROUP BY d.id
  `;
    const orderables = {
      code: 'd.code',
      date_dotation: 'd.date_dotation',
      statut: 'd.statut',
      dotation_type: 'd.dotation_type',
      beneficiary_type: 'd.beneficiary_type'
    };
    const orderCol = orderables[sortBy] || 'd.date_dotation';
    const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';
    let sql = `${select} ORDER BY ${orderCol} ${orderDir}, d.id DESC`;
    const listParams = [...params];
    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      listParams.push(Number(limit), Number(offset) || 0);
    }
    const rows = await db.all(sql, listParams);
    const totalRow = await db.get(
      `SELECT COUNT(DISTINCT d.id) AS cnt ${base}`,
      params
    );
    return { rows, total: totalRow?.cnt || 0 };
  }
};
module.exports.getDashboardDotations = async (req, res) => {
  try {
    const total = await db.get(`SELECT COUNT(*) as cnt FROM dotations`);
    const recent = await db.all(
      `SELECT * FROM dotations ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ total_dotations: total?.cnt || 0, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
module.exports.add = async ({ body = {}, currentUser }) => {
  const actorId = currentUser?.id || null;
  const now = nowISO();
  const payload = pickDotationPayload(body);
  payload.created_by = actorId;
  payload.updated_by = actorId;
  payload.created_at = now;
  payload.updated_at = now;
  payload.synced = 0;
  const columns = Object.keys(payload);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((column) => payload[column]);
  const result = await db.run(
    `INSERT INTO dotations (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  const dotationId = result.lastID;
  await replaceDotationItems({
    dotationId,
    items: Array.isArray(body.items) ? body.items : [],
    actorId,
    timestamp: now
  });
  const created = await this.get({ id: dotationId });
  await logDotationAudit({
    actorId,
    action: 'CREATE',
    dotationId,
    after: created
  });
  return created;
};
module.exports.update = async ({ id, body = {}, currentUser }) => {
  const existing = await this.get({ id });
  if (!existing) return null;
  const actorId = currentUser?.id || null;
  const now = nowISO();
  const payload = pickDotationPayload(body);
  if (Object.keys(payload).length) {
    payload.updated_by = actorId;
    payload.updated_at = now;
    payload.synced = 0;
    const setters = Object.keys(payload).map((column) => `${column} = ?`).join(', ');
    const values = Object.keys(payload).map((column) => payload[column]);
    await db.run(`UPDATE dotations SET ${setters} WHERE id = ?`, [...values, id]);
  }
  if (Array.isArray(body.items)) {
    await replaceDotationItems({
      dotationId: id,
      items: body.items,
      actorId,
      timestamp: now
    });
  }
  const updated = await this.get({ id });
  await logDotationAudit({
    actorId,
    action: 'UPDATE',
    dotationId: id,
    before: existing,
    after: updated
  });
  return updated;
};
module.exports.del = async ({ id, soft = true, currentUser }) => {
  const existing = await this.get({ id });
  if (!existing) return false;
  const actorId = currentUser?.id || null;
  const now = nowISO();
  if (soft !== false) {
    await db.run(
      `UPDATE dotations SET deleted_at = ?, deleted_by = ?, synced = 0 WHERE id = ?`,
      [now, actorId, id]
    );
    await db.run(
      `UPDATE dotation_items SET deleted_at = ?, synced = 0 WHERE dotation_id = ?`,
      [now, id]
    );
  } else {
    await db.run(`DELETE FROM dotation_items WHERE dotation_id = ?`, [id]);
    await db.run(`DELETE FROM dotations WHERE id = ?`, [id]);
  }
  await logDotationAudit({
    actorId,
    action: soft !== false ? 'SOFT_DELETE' : 'DELETE',
    dotationId: id,
    before: existing,
    after: null
  });
  return true;
};



