// controllers/syncLogController.js
'use strict';

const db = require('../database/database');

const TABLE = 'sync_logs';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['operation', 'status', 'details'];
const SORTABLE_FIELDS = ['id', 'date_sync', 'created_at'];

// Pas de soft delete pour les logs
const SOFT_DELETE = false;
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};
    let sql = `SELECT * FROM ${TABLE}`;
    const params = [];
    const where = [];

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      where.push(`(${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY ${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY date_sync DESC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE}`;
      const countParams = [];
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ');
        countSql += ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Récupérer un log par ID
   */
  async get({ id }) {
    const sql = `SELECT * FROM ${TABLE} WHERE id = ?`;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter un log
   */
  async add({ body }) {
    const { operation, status, details, date_sync } = body;
    if (!operation || !status) {
      throw new Error('Champs "operation" et "status" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (operation, status, details, date_sync, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      operation,
      status,
      details || '',
      date_sync || now,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour un log (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { operation, status, details, date_sync } = body;
    const sql = `
      UPDATE ${TABLE}
      SET operation = ?, status = ?, details = ?, date_sync = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      operation ?? existing.operation,
      status ?? existing.status,
      details ?? existing.details,
      date_sync ?? existing.date_sync,
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
   * Suppression définitive (pas de soft delete)
   */
  async del({ id }) {
    const sql = `DELETE FROM ${TABLE} WHERE id = ?`;
    await db.run(sql, [id]);
    return true;
  },

  /**
   * Ajout en masse
   */
  async bulkAdd({ items }) {
    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (operation, status, details, date_sync, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.operation,
        item.status,
        item.details || '',
        item.date_sync || now,
        now,
        now
      ]);
    }
    await stmt.finalize();
    return this.list({ listOpts: {} });
  },

  /**
   * Suppression en masse
   */
  async bulkDel({ ids }) {
    const sql = `DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`;
    await db.run(sql, ids);
    return { affected: ids.length };
  }
};
