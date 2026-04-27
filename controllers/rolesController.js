// controllers/rolesController.js
'use strict';

const db = require('../database/database');

// Nom de la table
const TABLE = 'roles';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['nom', 'description'];
const SORTABLE_FIELDS = ['id', 'nom', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

// Helpers
const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters, softDelete }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `SELECT * FROM ${TABLE}`;
    const params = [];

    // Filtre soft delete
    if (SOFT_DELETE) {
      sql += ` WHERE ${COL_DELETED_AT} IS NULL`;
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ');
      sql += SOFT_DELETE ? ` AND (${conds})` : ` WHERE (${conds})`;
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY ${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY id ASC`;
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
      if (SOFT_DELETE) {
        countSql += ` WHERE ${COL_DELETED_AT} IS NULL`;
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
   * Récupérer un rôle par ID
   */
  async get({ id }) {
    const sql = `SELECT * FROM ${TABLE} WHERE id = ? ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}`;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter un rôle
   */
  async add({ body }) {
    const { nom, description } = body;
    if (!nom) throw new Error('Le champ "nom" est obligatoire');

    const sql = `INSERT INTO ${TABLE} (nom, description, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
                 VALUES (?, ?, ?, ?)`;
    const now = nowISO();
    const result = await db.run(sql, [nom, description || null, now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour un rôle (PUT)
   */
  async update({ id, body }) {
    const { nom, description } = body;
    const existing = await this.get({ id });
    if (!existing) return null;

    const sql = `UPDATE ${TABLE}
                 SET nom = ?, description = ?, ${COL_UPDATED_AT} = ?
                 WHERE id = ?`;
    await db.run(sql, [nom ?? existing.nom, description ?? existing.description, nowISO(), id]);

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
  async del({ id, soft, softColumn }) {
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
    const sql = `INSERT INTO ${TABLE} (nom, description, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
                 VALUES (?, ?, ?, ?)`;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([item.nom, item.description || null, now, now]);
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
