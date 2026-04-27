// controllers/dotationMaterielSpecifiqueController.js
'use strict';

const db = require('../database/database');

const TABLE = 'dotation_materiel_specifique';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['materiel_numero_serie', 'vdp_nom', 'lot_code'];
const SORTABLE_FIELDS = ['id', 'date_dotation', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT dms.*, 
             ms.numero_serie AS materiel_numero_serie,
             ms.nom AS materiel_nom,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} dms
      LEFT JOIN materiel_specifique ms ON dms.materiel_id = ms.id
      LEFT JOIN vdp v ON dms.vdp_id = v.id
      LEFT JOIN lots l ON dms.lot_id = l.id
      LEFT JOIN entites e ON dms.entite_id = e.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`dms.${COL_DELETED_AT} IS NULL`);
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY dms.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY dms.date_dotation DESC`;
    }

    // Pagination
    if (limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset || 0);
    }

    const rows = await db.all(sql, params);

    // Total
    let total = rows.length;
    if (limit) {
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} dms`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE dms.${COL_DELETED_AT} IS NULL`;
      }
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ');
        countSql += SOFT_DELETE ? ` AND (${conds})` : ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Récupérer une dotation de matériel spécifique par ID
   */
  async get({ id }) {
    const sql = `
      SELECT dms.*, 
             ms.numero_serie AS materiel_numero_serie,
             ms.nom AS materiel_nom,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} dms
      LEFT JOIN materiel_specifique ms ON dms.materiel_id = ms.id
      LEFT JOIN vdp v ON dms.vdp_id = v.id
      LEFT JOIN lots l ON dms.lot_id = l.id
      LEFT JOIN entites e ON dms.entite_id = e.id
      WHERE dms.id = ? ${SOFT_DELETE ? `AND dms.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une dotation de matériel spécifique
   */
  async add({ body }) {
    const { materiel_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    if (!materiel_id || !vdp_id || !lot_id || !entite_id) {
      throw new Error('Champs "materiel_id", "vdp_id", "lot_id" et "entite_id" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (materiel_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      materiel_id,
      vdp_id,
      lot_id,
      entite_id,
      date_dotation || now,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour une dotation de matériel spécifique (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { materiel_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    const sql = `
      UPDATE ${TABLE}
      SET materiel_id = ?, vdp_id = ?, lot_id = ?, entite_id = ?, date_dotation = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      materiel_id ?? existing.materiel_id,
      vdp_id ?? existing.vdp_id,
      lot_id ?? existing.lot_id,
      entite_id ?? existing.entite_id,
      date_dotation ?? existing.date_dotation,
      nowISO(),
      id
    ]);

    return this.get({ id });
  },

  /**
   * Mise à jour partielle (PATCH)
   */
  async patch({ id, body }) {
    return this.update({ id, body });
  },

  /**
   * Suppression (soft delete si activé)
   */
  async del({ id, soft }) {
    const existing = await this.get({ id });
    if (!existing) return false;

    if (SOFT_DELETE && soft !== false) {
      const sql = `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id = ?`;
      await db.run(sql, [nowISO(), id]);
      return true;
    } else {
      const sql = `DELETE FROM ${TABLE} WHERE id = ?`;
      await db.run(sql, [id]);
      return true;
    }
  },

  /**
   * Ajout en masse
   */
  async bulkAdd({ items }) {
    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (materiel_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.materiel_id,
        item.vdp_id,
        item.lot_id,
        item.entite_id,
        item.date_dotation || now,
        now,
        now
      ]);
    }
    await stmt.finalize();
    return this.list({ listOpts: {}, filters: {} });
  },

  /**
   * Suppression en masse
   */
  async bulkDel({ ids, soft }) {
    if (SOFT_DELETE && soft !== false) {
      const sql = `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id IN (${ids.map(() => '?').join(',')})`;
      await db.run(sql, [nowISO(), ...ids]);
    } else {
      const sql = `DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`;
      await db.run(sql, ids);
    }
    return { affected: ids.length };
  }
};
