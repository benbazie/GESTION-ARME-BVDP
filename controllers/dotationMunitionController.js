// controllers/dotationMunitionController.js
'use strict';

const db = require('../database/database');

const TABLE = 'dotation_munitions';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['lot_code', 'vdp_nom', 'calibre', 'type'];
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
      SELECT dm.*, 
             m.calibre, m.type, m.lot_numero,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} dm
      LEFT JOIN munitions m ON dm.munition_id = m.id
      LEFT JOIN vdp v ON dm.vdp_id = v.id
      LEFT JOIN lots l ON dm.lot_id = l.id
      LEFT JOIN entites e ON dm.entite_id = e.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`dm.${COL_DELETED_AT} IS NULL`);
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
      sql += ` ORDER BY dm.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY dm.date_dotation DESC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} dm`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE dm.${COL_DELETED_AT} IS NULL`;
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
   * Récupérer une dotation de munition par ID
   */
  async get({ id }) {
    const sql = `
      SELECT dm.*, 
             m.calibre, m.type, m.lot_numero,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} dm
      LEFT JOIN munitions m ON dm.munition_id = m.id
      LEFT JOIN vdp v ON dm.vdp_id = v.id
      LEFT JOIN lots l ON dm.lot_id = l.id
      LEFT JOIN entites e ON dm.entite_id = e.id
      WHERE dm.id = ? ${SOFT_DELETE ? `AND dm.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une dotation de munition
   */
  async add({ body }) {
    const { munition_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    if (!munition_id || !vdp_id || !lot_id || !entite_id) {
      throw new Error('Champs "munition_id", "vdp_id", "lot_id" et "entite_id" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (munition_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      munition_id,
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
   * Mettre à jour une dotation de munition (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { munition_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    const sql = `
      UPDATE ${TABLE}
      SET munition_id = ?, vdp_id = ?, lot_id = ?, entite_id = ?, date_dotation = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      munition_id ?? existing.munition_id,
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
      INSERT INTO ${TABLE} (munition_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.munition_id,
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
