// controllers/sessionController.js
'use strict';

const db = require('../database/database');

const TABLE = 'sessions';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['token', 'utilisateur_nom', 'utilisateur_email'];
const SORTABLE_FIELDS = ['id', 'created_at', 'expires_at'];

// Soft delete et timestamps
const SOFT_DELETE = false; // Les sessions expirées sont supprimées, pas archivées
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste des sessions
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT s.*, u.nom AS utilisateur_nom, u.email AS utilisateur_email
      FROM ${TABLE} s
      LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
    `;
    const params = [];
    const where = [];

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
      sql += ` ORDER BY s.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY s.${COL_CREATED_AT} DESC`;
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
   * Récupérer une session par ID
   */
  async get({ id }) {
    const sql = `
      SELECT s.*, u.nom AS utilisateur_nom, u.email AS utilisateur_email
      FROM ${TABLE} s
      LEFT JOIN utilisateurs u ON s.utilisateur_id = u.id
      WHERE s.id = ?
    `;
    return db.get(sql, [id]);
  },

  /**
   * Créer une session
   */
  async add({ body }) {
    const { utilisateur_id, token, expires_at } = body;
    if (!utilisateur_id || !token) {
      throw new Error('Champs "utilisateur_id" et "token" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (utilisateur_id, token, expires_at, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      utilisateur_id,
      token,
      expires_at || null,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour une session (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { utilisateur_id, token, expires_at } = body;
    const sql = `
      UPDATE ${TABLE}
      SET utilisateur_id = ?, token = ?, expires_at = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      utilisateur_id ?? existing.utilisateur_id,
      token ?? existing.token,
      expires_at ?? existing.expires_at,
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
   * Supprimer une session (déconnexion)
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
