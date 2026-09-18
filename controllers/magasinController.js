'use strict';

/**
 * magasinController.js
 * Gestion des magasins (armureries) par niveau hiérarchique.
 * Couvre : CRUD magasins, stock courant, mouvements, dotation avec mise à jour statut arme.
 */

const db = require('../database/database');

/* ============================================================ */
/*  Helpers                                                      */
/* ============================================================ */

const row  = (sql, params = []) => db.db.get(sql, params);
const rows = (sql, params = []) => db.db.all(sql, params);
const run  = (sql, params = []) => db.db.run(sql, params);

/** Retourne le nom lisible du niveau hiérarchique d'un magasin. */
const niveauLabel = (m) => {
  if (m.entite_id)                   return m.entite_nom   || 'Entité';
  if (m.coordination_regionale_id)   return m.coord_reg_nom  || 'Coord. Régionale';
  if (m.coordination_provinciale_id) return m.coord_prov_nom || 'Coord. Provinciale';
  if (m.coordination_communale_id)   return m.coord_com_nom  || 'Coord. Communale';
  if (m.localite_id)                 return m.localite_nom   || 'Localité';
  return '—';
};

/** Génère un code unique pour un magasin. */
const genCode = (nom) =>
  'MAG-' + nom.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) +
  '-' + Date.now().toString(36).toUpperCase().slice(-4);

/* ============================================================ */
/*  LISTE DES MAGASINS                                           */
/* ============================================================ */

exports.list = async (req, res) => {
  try {
    const { actif, entite_id, localite_id, coordination_regionale_id,
            coordination_provinciale_id, coordination_communale_id, q } = req.query;

    const whereParts = ['m.deleted_at IS NULL'];
    const params = [];

    // Filtre de portée : les gestionnaires ne voient que leur(s) magasin(s)
    const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const isPrivileged = userRoles.some((r) =>
      ['admin', 'superadmin', 'role_admin'].includes(r)
    );
    if (!isPrivileged && req.user?.id &&
        userRoles.some((r) => r === 'gestionnaire')) {
      whereParts.push('m.gestionnaire_id = ?');
      params.push(req.user.id);
    }

    if (actif !== undefined) {
      whereParts.push('m.actif = ?');
      params.push(actif === 'true' || actif === '1');
    }
    if (entite_id)                   { whereParts.push('m.entite_id = ?');                   params.push(Number(entite_id)); }
    if (localite_id)                 { whereParts.push('m.localite_id = ?');                 params.push(Number(localite_id)); }
    if (coordination_regionale_id)   { whereParts.push('m.coordination_regionale_id = ?');   params.push(Number(coordination_regionale_id)); }
    if (coordination_provinciale_id) { whereParts.push('m.coordination_provinciale_id = ?'); params.push(Number(coordination_provinciale_id)); }
    if (coordination_communale_id)   { whereParts.push('m.coordination_communale_id = ?');   params.push(Number(coordination_communale_id)); }
    if (q) {
      whereParts.push('(LOWER(m.nom) LIKE LOWER(?) OR LOWER(m.code) LIKE LOWER(?))');
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const sql = `
      SELECT
        m.*,
        e.nom    AS entite_nom,
        cr.nom   AS coord_reg_nom,
        cp.nom   AS coord_prov_nom,
        cc.nom   AS coord_com_nom,
        l.nom    AS localite_nom,
        u.nom    AS gestionnaire_nom,
        u.prenom AS gestionnaire_prenom,
        (SELECT COUNT(*) FROM stock_magasin s WHERE s.magasin_id = m.id) AS nb_items_stock
      FROM magasins m
      LEFT JOIN entites               e  ON e.id  = m.entite_id
      LEFT JOIN coordination_regionale   cr ON cr.id = m.coordination_regionale_id
      LEFT JOIN coordination_provinciale cp ON cp.id = m.coordination_provinciale_id
      LEFT JOIN coordination_communale   cc ON cc.id = m.coordination_communale_id
      LEFT JOIN localites             l  ON l.id  = m.localite_id
      LEFT JOIN utilisateurs          u  ON u.id  = m.gestionnaire_id
      ${where}
      ORDER BY m.nom ASC
    `;

    const data = await rows(sql, params);
    return res.json(data || []);
  } catch (err) {
    console.error('[magasin] list:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  DÉTAIL D'UN MAGASIN                                          */
/* ============================================================ */

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT
        m.*,
        e.nom    AS entite_nom,
        cr.nom   AS coord_reg_nom,
        cp.nom   AS coord_prov_nom,
        cc.nom   AS coord_com_nom,
        l.nom    AS localite_nom,
        u.nom    AS gestionnaire_nom,
        u.prenom AS gestionnaire_prenom
      FROM magasins m
      LEFT JOIN entites               e  ON e.id  = m.entite_id
      LEFT JOIN coordination_regionale   cr ON cr.id = m.coordination_regionale_id
      LEFT JOIN coordination_provinciale cp ON cp.id = m.coordination_provinciale_id
      LEFT JOIN coordination_communale   cc ON cc.id = m.coordination_communale_id
      LEFT JOIN localites             l  ON l.id  = m.localite_id
      LEFT JOIN utilisateurs          u  ON u.id  = m.gestionnaire_id
      WHERE m.id = ? AND m.deleted_at IS NULL
    `;
    const magasin = await row(sql, [id]);
    if (!magasin) return res.status(404).json({ error: 'Magasin introuvable' });
    return res.json(magasin);
  } catch (err) {
    console.error('[magasin] getById:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  CRÉER UN MAGASIN                                             */
/* ============================================================ */

exports.create = async (req, res) => {
  try {
    const {
      nom, niveau,
      entite_id, coordination_regionale_id, coordination_provinciale_id,
      coordination_communale_id, localite_id,
      gestionnaire_id, actif = true, observation,
    } = req.body;

    if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom du magasin est requis.' });

    const code = genCode(nom.trim());

    const sql = `
      INSERT INTO magasins
        (nom, code, niveau, entite_id, coordination_regionale_id, coordination_provinciale_id,
         coordination_communale_id, localite_id, gestionnaire_id, actif, observation)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      RETURNING *
    `;
    const created = await row(sql, [
      nom.trim(), code, niveau || 'local',
      entite_id || null, coordination_regionale_id || null,
      coordination_provinciale_id || null, coordination_communale_id || null,
      localite_id || null, gestionnaire_id || null,
      actif !== false, observation || null,
    ]);

    return res.status(201).json(created);
  } catch (err) {
    console.error('[magasin] create:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  METTRE À JOUR UN MAGASIN                                     */
/* ============================================================ */

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await row(`SELECT id FROM magasins WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!existing) return res.status(404).json({ error: 'Magasin introuvable' });

    const {
      nom, niveau,
      entite_id, coordination_regionale_id, coordination_provinciale_id,
      coordination_communale_id, localite_id,
      gestionnaire_id, actif, observation,
    } = req.body;

    const fields = [];
    const params = [];
    const set = (col, val) => { fields.push(`${col} = ?`); params.push(val); };

    if (nom          !== undefined) set('nom',           nom.trim());
    if (niveau       !== undefined) set('niveau',        niveau);
    if (entite_id    !== undefined) set('entite_id',     entite_id   || null);
    if (coordination_regionale_id   !== undefined) set('coordination_regionale_id',   coordination_regionale_id   || null);
    if (coordination_provinciale_id !== undefined) set('coordination_provinciale_id', coordination_provinciale_id || null);
    if (coordination_communale_id   !== undefined) set('coordination_communale_id',   coordination_communale_id   || null);
    if (localite_id     !== undefined) set('localite_id',     localite_id     || null);
    if (gestionnaire_id !== undefined) set('gestionnaire_id', gestionnaire_id || null);
    if (actif           !== undefined) set('actif',           actif !== false);
    if (observation     !== undefined) set('observation',     observation     || null);

    if (!fields.length) return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });

    set('updated_at', new Date().toISOString());
    params.push(id);

    const updated = await row(
      `UPDATE magasins SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
      params
    );
    return res.json(updated);
  } catch (err) {
    console.error('[magasin] update:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  SUPPRIMER (soft delete) UN MAGASIN                           */
/* ============================================================ */

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await row(`SELECT id FROM magasins WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!existing) return res.status(404).json({ error: 'Magasin introuvable' });

    const stock = await row(`SELECT COUNT(*) AS nb FROM stock_magasin WHERE magasin_id = ?`, [id]);
    if (stock && Number(stock.nb) > 0) {
      return res.status(409).json({ error: 'Impossible de supprimer : le magasin contient du stock.' });
    }

    await run(`UPDATE magasins SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?`, [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[magasin] remove:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  STOCK D'UN MAGASIN                                           */
/* ============================================================ */

exports.getStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { resource_type } = req.query;

    const magasin = await row(`SELECT id FROM magasins WHERE id = ? AND deleted_at IS NULL`, [id]);
    if (!magasin) return res.status(404).json({ error: 'Magasin introuvable' });

    const whereParts = ['s.magasin_id = ?'];
    const params = [id];
    if (resource_type) { whereParts.push('s.resource_type = ?'); params.push(resource_type); }

    const sql = `
      SELECT
        s.id, s.magasin_id, s.resource_type, s.resource_id, s.quantite,
        CASE s.resource_type
          WHEN 'arme'               THEN a.numero_serie
          WHEN 'optique'            THEN o.numero_serie
          WHEN 'materiel_specifique' THEN ms.numero_serie
          ELSE NULL
        END AS numero_serie,
        CASE s.resource_type
          WHEN 'arme'               THEN COALESCE(ca.designation, a.etat)
          WHEN 'optique'            THEN co.designation
          WHEN 'materiel_specifique' THEN cm.designation
          WHEN 'munition'           THEN cmun.designation
          ELSE NULL
        END AS designation,
        CASE s.resource_type
          WHEN 'arme'               THEN a.etat
          WHEN 'optique'            THEN o.etat
          WHEN 'materiel_specifique' THEN ms.etat
          ELSE NULL
        END AS etat
      FROM stock_magasin s
      LEFT JOIN armes              a    ON s.resource_type = 'arme'               AND a.id   = s.resource_id
      LEFT JOIN config_arme        ca   ON ca.id = a.config_arme_id
      LEFT JOIN optiques           o    ON s.resource_type = 'optique'            AND o.id   = s.resource_id
      LEFT JOIN config_optique     co   ON co.id = o.config_optique_id
      LEFT JOIN materiels_specifiques ms ON s.resource_type = 'materiel_specifique' AND ms.id = s.resource_id
      LEFT JOIN config_materiel    cm   ON cm.id = ms.config_materiel_id
      LEFT JOIN munitions          mun  ON s.resource_type = 'munition'           AND mun.id = s.resource_id
      LEFT JOIN config_munition    cmun ON cmun.id = mun.config_munition_id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY s.resource_type, designation
    `;

    const data = await rows(sql, params);
    return res.json(data || []);
  } catch (err) {
    console.error('[magasin] getStock:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  ENTRÉE MANUELLE EN STOCK (initialisation ou ajout)          */
/* ============================================================ */

exports.addToStock = async (req, res) => {
  try {
    const { id: magasin_id } = req.params;
    const { resource_type, resource_id, quantite = 1, lot_id, observation } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type et resource_id sont requis.' });
    }

    const magasin = await row(`SELECT id FROM magasins WHERE id = ? AND deleted_at IS NULL`, [magasin_id]);
    if (!magasin) return res.status(404).json({ error: 'Magasin introuvable' });

    const qty = Number(quantite) || 1;
    const acteur_id = req.user?.id || null;

    // Upsert stock
    await run(`
      INSERT INTO stock_magasin (magasin_id, resource_type, resource_id, quantite)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (magasin_id, resource_type, resource_id)
      DO UPDATE SET quantite = stock_magasin.quantite + EXCLUDED.quantite, updated_at = NOW()
    `, [magasin_id, resource_type, Number(resource_id), qty]);

    // Mettre à jour statut arme
    if (resource_type === 'arme') {
      await run(`UPDATE armes SET statut = 'en_stock', magasin_id = ?, updated_at = NOW() WHERE id = ?`,
        [magasin_id, resource_id]);
    }

    // Journal
    const acteurRow = acteur_id ? await row(`SELECT nom, prenom FROM utilisateurs WHERE id = ?`, [acteur_id]) : null;
    await run(`
      INSERT INTO mouvements_magasin
        (magasin_id, type, resource_type, resource_id, quantite, lot_id, acteur_id, acteur_nom, observation)
      VALUES (?, 'entree_manuelle', ?, ?, ?, ?, ?, ?, ?)
    `, [
      magasin_id, resource_type, Number(resource_id), qty,
      lot_id || null, acteur_id,
      acteurRow ? `${acteurRow.nom} ${acteurRow.prenom || ''}`.trim() : null,
      observation || null,
    ]);

    const stock = await row(`SELECT * FROM stock_magasin WHERE magasin_id = ? AND resource_type = ? AND resource_id = ?`,
      [magasin_id, resource_type, resource_id]);
    return res.status(201).json(stock);
  } catch (err) {
    console.error('[magasin] addToStock:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  RETRAIT DU STOCK (réintégration ou perte)                    */
/* ============================================================ */

exports.removeFromStock = async (req, res) => {
  try {
    const { id: magasin_id } = req.params;
    const { resource_type, resource_id, quantite = 1, type = 'perte', observation } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type et resource_id sont requis.' });
    }

    const qty = Number(quantite) || 1;
    const acteur_id = req.user?.id || null;

    const stock = await row(`
      SELECT * FROM stock_magasin WHERE magasin_id = ? AND resource_type = ? AND resource_id = ?
    `, [magasin_id, resource_type, resource_id]);

    if (!stock) return res.status(404).json({ error: 'Cet article n\'est pas en stock dans ce magasin.' });
    if (stock.quantite < qty) return res.status(409).json({ error: `Stock insuffisant : ${stock.quantite} disponible(s).` });

    if (stock.quantite - qty === 0) {
      await run(`DELETE FROM stock_magasin WHERE magasin_id = ? AND resource_type = ? AND resource_id = ?`,
        [magasin_id, resource_type, resource_id]);
    } else {
      await run(`UPDATE stock_magasin SET quantite = quantite - ?, updated_at = NOW()
                 WHERE magasin_id = ? AND resource_type = ? AND resource_id = ?`,
        [qty, magasin_id, resource_type, resource_id]);
    }

    // Journal
    const acteurRow = acteur_id ? await row(`SELECT nom, prenom FROM utilisateurs WHERE id = ?`, [acteur_id]) : null;
    await run(`
      INSERT INTO mouvements_magasin
        (magasin_id, type, resource_type, resource_id, quantite, acteur_id, acteur_nom, observation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      magasin_id, type, resource_type, Number(resource_id), qty, acteur_id,
      acteurRow ? `${acteurRow.nom} ${acteurRow.prenom || ''}`.trim() : null,
      observation || null,
    ]);

    return res.json({ ok: true, remaining: stock.quantite - qty });
  } catch (err) {
    console.error('[magasin] removeFromStock:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  MOUVEMENTS D'UN MAGASIN                                      */
/* ============================================================ */

exports.getMouvements = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, resource_type, limit = 100, offset = 0 } = req.query;

    const whereParts = ['mv.magasin_id = ?'];
    const params = [id];
    if (type)          { whereParts.push('mv.type = ?');          params.push(type); }
    if (resource_type) { whereParts.push('mv.resource_type = ?'); params.push(resource_type); }

    const sql = `
      SELECT mv.*, d.code AS dotation_code
      FROM mouvements_magasin mv
      LEFT JOIN dotations d ON d.id = mv.dotation_id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY mv.date_mouvement DESC
      LIMIT ? OFFSET ?
    `;
    params.push(Number(limit), Number(offset));

    const data = await rows(sql, params);
    return res.json(data || []);
  } catch (err) {
    console.error('[magasin] getMouvements:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  RÉINTÉGRATION : VDP remet une arme dans un magasin           */
/* ============================================================ */

exports.reintegration = async (req, res) => {
  try {
    const { id: magasin_id } = req.params;
    const { dotation_item_id, resource_type, resource_id, condition_retour, observation } = req.body;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type et resource_id sont requis.' });
    }

    const magasin = await row(`SELECT id FROM magasins WHERE id = ? AND deleted_at IS NULL`, [magasin_id]);
    if (!magasin) return res.status(404).json({ error: 'Magasin introuvable' });

    const acteur_id = req.user?.id || null;
    const acteurRow = acteur_id ? await row(`SELECT nom, prenom FROM utilisateurs WHERE id = ?`, [acteur_id]) : null;
    const acteur_nom = acteurRow ? `${acteurRow.nom} ${acteurRow.prenom || ''}`.trim() : null;

    // Remettre en stock
    await run(`
      INSERT INTO stock_magasin (magasin_id, resource_type, resource_id, quantite)
      VALUES (?, ?, ?, 1)
      ON CONFLICT (magasin_id, resource_type, resource_id)
      DO UPDATE SET quantite = stock_magasin.quantite + 1, updated_at = NOW()
    `, [magasin_id, resource_type, Number(resource_id)]);

    // Mettre à jour statut arme
    if (resource_type === 'arme') {
      const statut = ['perdu', 'détruit', 'perdue', 'détruite'].includes(condition_retour)
        ? condition_retour.replace('é', 'e').replace('è', 'e') // normalise
        : 'en_stock';
      await run(`UPDATE armes SET statut = ?, magasin_id = ?, updated_at = NOW() WHERE id = ?`,
        [statut, magasin_id, resource_id]);
    }

    // Mettre à jour l'item de dotation si fourni
    if (dotation_item_id) {
      await run(`
        UPDATE dotation_items
        SET status = 'retourné', condition_retour = ?, returned_at = NOW(), returned_by = ?, updated_at = NOW()
        WHERE id = ?
      `, [condition_retour || null, acteur_id, dotation_item_id]);
    }

    // Journal mouvement
    await run(`
      INSERT INTO mouvements_magasin
        (magasin_id, type, resource_type, resource_id, quantite, acteur_id, acteur_nom, observation)
      VALUES (?, 'retour_vdp', ?, ?, 1, ?, ?, ?)
    `, [magasin_id, resource_type, Number(resource_id), acteur_id, acteur_nom, observation || null]);

    return res.json({ ok: true, message: 'Réintégration enregistrée.' });
  } catch (err) {
    console.error('[magasin] reintegration:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};

/* ============================================================ */
/*  INVENTAIRE (résumé par type de ressource)                    */
/* ============================================================ */

exports.inventaire = async (req, res) => {
  try {
    const { id } = req.params;

    const magasin = await row(`
      SELECT m.*, e.nom AS entite_nom, l.nom AS localite_nom
      FROM magasins m
      LEFT JOIN entites e ON e.id = m.entite_id
      LEFT JOIN localites l ON l.id = m.localite_id
      WHERE m.id = ? AND m.deleted_at IS NULL
    `, [id]);
    if (!magasin) return res.status(404).json({ error: 'Magasin introuvable' });

    const summary = await rows(`
      SELECT resource_type, COUNT(*) AS nb_lignes, SUM(quantite) AS quantite_totale
      FROM stock_magasin WHERE magasin_id = ?
      GROUP BY resource_type
    `, [id]);

    const stock = await rows(`
      SELECT
        s.resource_type, s.resource_id, s.quantite,
        CASE s.resource_type
          WHEN 'arme'               THEN a.numero_serie
          WHEN 'optique'            THEN o.numero_serie
          WHEN 'materiel_specifique' THEN ms.numero_serie
          ELSE NULL
        END AS numero_serie,
        CASE s.resource_type
          WHEN 'arme'               THEN COALESCE(ca.designation, '')
          WHEN 'optique'            THEN COALESCE(co.designation, '')
          WHEN 'materiel_specifique' THEN COALESCE(cm.designation, '')
          WHEN 'munition'           THEN COALESCE(cmun.designation, '')
          ELSE ''
        END AS designation,
        CASE s.resource_type WHEN 'arme' THEN a.etat ELSE NULL END AS etat
      FROM stock_magasin s
      LEFT JOIN armes              a    ON s.resource_type = 'arme'               AND a.id  = s.resource_id
      LEFT JOIN config_arme        ca   ON ca.id = a.config_arme_id
      LEFT JOIN optiques           o    ON s.resource_type = 'optique'            AND o.id  = s.resource_id
      LEFT JOIN config_optique     co   ON co.id = o.config_optique_id
      LEFT JOIN materiels_specifiques ms ON s.resource_type = 'materiel_specifique' AND ms.id = s.resource_id
      LEFT JOIN config_materiel    cm   ON cm.id = ms.config_materiel_id
      LEFT JOIN munitions          mun  ON s.resource_type = 'munition'           AND mun.id = s.resource_id
      LEFT JOIN config_munition    cmun ON cmun.id = mun.config_munition_id
      WHERE s.magasin_id = ?
      ORDER BY s.resource_type, designation
    `, [id]);

    return res.json({ magasin, summary: summary || [], stock: stock || [] });
  } catch (err) {
    console.error('[magasin] inventaire:', err.message);
    return res.status(500).json({ error: 'Erreur BD', detail: err.message });
  }
};
