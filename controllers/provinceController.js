// controllers/provinceController.js
'use strict';

const db = require('../database/database');

const TABLE = 'provinces';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['nom', 'code'];
const SORTABLE_FIELDS = ['id', 'nom', 'code', 'created_at'];

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
      SELECT p.*, r.nom AS region_nom
      FROM ${TABLE} p
      LEFT JOIN regions r ON p.region_id = r.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`p.${COL_DELETED_AT} IS NULL`);
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `p.${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY p.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY p.id ASC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} p`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE p.${COL_DELETED_AT} IS NULL`;
      }
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `p.${f} LIKE ?`).join(' OR ');
        countSql += SOFT_DELETE ? ` AND (${conds})` : ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Récupérer une province par ID
   */
  async get({ id }) {
    const sql = `
      SELECT p.*, r.nom AS region_nom
      FROM ${TABLE} p
      LEFT JOIN regions r ON p.region_id = r.id
      WHERE p.id = ? ${SOFT_DELETE ? `AND p.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une province
   */
  async add({ body }) {
    const { nom, code, region_id } = body;
    if (!nom || !code) {
      throw new Error('Champs "nom" et "code" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (nom, code, region_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      nom,
      code,
      region_id || null,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour une province (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { nom, code, region_id } = body;
    const sql = `
      UPDATE ${TABLE}
      SET nom = ?, code = ?, region_id = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      nom ?? existing.nom,
      code ?? existing.code,
      region_id ?? existing.region_id,
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
      INSERT INTO ${TABLE} (nom, code, region_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.nom,
        item.code,
        item.region_id || null,
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
