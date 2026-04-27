// controllers/auditLogController.js
'use strict';

const db = require('../database/database');

const TABLE = 'audit_logs';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['action', 'table_name', 'record_id', 'utilisateur_nom', 'details'];
const SORTABLE_FIELDS = ['id', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = false; // Les logs ne sont jamais supprimés logiquement
const COL_CREATED_AT = 'created_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT al.*, u.nom AS utilisateur_nom, u.username AS utilisateur_username
      FROM ${TABLE} al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
    `;
    const params = [];
    const where = [];

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `al.${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY al.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY al.${COL_CREATED_AT} DESC`;
    }

    // Pagination
    if (limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset || 0);
    }

    const rows = await db.all(sql, params);
    return { rows, total: rows.length };
  },

  /**
   * Récupérer un log par ID
   */
  async get({ id }) {
    const sql = `
      SELECT al.*, u.nom AS utilisateur_nom, u.username AS utilisateur_username
      FROM ${TABLE} al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      WHERE al.id = ?
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter un log
   */
  async add({ body }) {
    const { utilisateur_id, action, table_name, record_id, details } = body;
    if (!utilisateur_id || !action || !table_name) {
      throw new Error('Champs "utilisateur_id", "action" et "table_name" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (utilisateur_id, action, table_name, record_id, details, ${COL_CREATED_AT})
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      utilisateur_id,
      action,
      table_name,
      record_id || null,
      details || null,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Suppression physique (rarement utilisée)
   */
  async del({ id }) {
    const sql = `DELETE FROM ${TABLE} WHERE id = ?`;
    await db.run(sql, [id]);
    return true;
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
