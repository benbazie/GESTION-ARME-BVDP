'use strict';

const db = require('../database/database');

const TABLE = 'dotation_armes';
const SEARCH_FIELDS = ['arme_numero_serie', 'vdp_nom', 'lot_code'];
const SORTABLE_FIELDS = ['id', 'date_dotation', 'created_at'];
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

const controller = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT da.*, 
             a.numero_serie AS arme_numero_serie,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} da
      LEFT JOIN armes a ON da.arme_id = a.id
      LEFT JOIN vdp v ON da.vdp_id = v.id
      LEFT JOIN lots l ON da.lot_id = l.id
      LEFT JOIN entites e ON da.entite_id = e.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`da.${COL_DELETED_AT} IS NULL`);
    }

    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY da.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY da.date_dotation DESC`;
    }

    if (limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset || 0);
    }

    const rows = await db.all(sql, params);

    let total = rows.length;
    if (limit) {
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} da`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE da.${COL_DELETED_AT} IS NULL`;
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

  async get({ id }) {
    const sql = `
      SELECT da.*, 
             a.numero_serie AS arme_numero_serie,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} da
      LEFT JOIN armes a ON da.arme_id = a.id
      LEFT JOIN vdp v ON da.vdp_id = v.id
      LEFT JOIN lots l ON da.lot_id = l.id
      LEFT JOIN entites e ON da.entite_id = e.id
      WHERE da.id = ? ${SOFT_DELETE ? `AND da.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  async add({ body }) {
    const { arme_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    if (!arme_id || !vdp_id || !lot_id || !entite_id) {
      throw new Error('Champs "arme_id", "vdp_id", "lot_id" et "entite_id" obligatoires');
    }

    const checkSql = `
      SELECT * FROM ${TABLE}
      WHERE arme_id = ? AND ${COL_DELETED_AT} IS NULL
    `;
    const existingDotation = await db.get(checkSql, [arme_id]);
    if (existingDotation) {
      throw new Error('Cette arme est déjà dotée à un VDP actif');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (arme_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      arme_id,
      vdp_id,
      lot_id,
      entite_id,
      date_dotation || now,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { arme_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    const sql = `
      UPDATE ${TABLE}
      SET arme_id = ?, vdp_id = ?, lot_id = ?, entite_id = ?, date_dotation = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      arme_id ?? existing.arme_id,
      vdp_id ?? existing.vdp_id,
      lot_id ?? existing.lot_id,
      entite_id ?? existing.entite_id,
      date_dotation ?? existing.date_dotation,
      nowISO(),
      id
    ]);

    return this.get({ id });
  },

  async patch({ id, body }) {
    return this.update({ id, body });
  },

  async del({ id, soft }) {
    const existing = await this.get({ id });
    if (!existing) return false;

    if (SOFT_DELETE && soft !== false) {
      const sql = `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id = ?`;
      await db.run(sql, [nowISO(), id]);
    } else {
      const sql = `DELETE FROM ${TABLE} WHERE id = ?`;
      await db.run(sql, [id]);
    }
    return true;
  },

  async bulkAdd({ items }) {
    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (arme_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.arme_id,
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

  async bulkDel({ ids, soft }) {
    if (SOFT_DELETE && soft !== false) {
      const sql = `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id IN (${ids.map(() => '?').join(',')})`;
      await db.run(sql, [nowISO(), ...ids]);
    } else {
      const sql = `DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`;
      await db.run(sql, ids);
    }
    return { affected: ids.length };
  },

  /**
   * Route custom : Dashboard Dotations Arme
   */
  async getDashboardDotationsArme(req, res) {
    try {
      const total = await db.get(
        `SELECT COUNT(*) as cnt FROM ${TABLE} ${SOFT_DELETE ? `WHERE ${COL_DELETED_AT} IS NULL` : ''}`
      );
      const recent = await db.all(
        `SELECT da.*, a.numero_serie AS arme_numero_serie, v.nom AS vdp_nom
         FROM ${TABLE} da
         LEFT JOIN armes a ON da.arme_id = a.id
         LEFT JOIN vdp v ON da.vdp_id = v.id
         ${SOFT_DELETE ? `WHERE da.${COL_DELETED_AT} IS NULL` : ''}
         ORDER BY da.${COL_CREATED_AT} DESC LIMIT 10`
      );
      res.json({
        total_dotations_armes: total?.cnt || 0,
        recent
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
};

// Export complet
module.exports = controller;
// Export explicite de la méthode dashboard
module.exports.getDashboardDotationsArme = controller.getDashboardDotationsArme;
