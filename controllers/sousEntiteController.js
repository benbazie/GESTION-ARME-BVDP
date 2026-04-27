// controllers/sousEntiteController.js
'use strict';

const db = require('../database/database');

const TABLE = 'sous_entites';

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
      SELECT se.*, e.nom AS entite_nom, l.nom AS localite_nom
      FROM ${TABLE} se
      LEFT JOIN entites e ON se.entite_id = e.id
      LEFT JOIN localites l ON se.localite_id = l.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`se.${COL_DELETED_AT} IS NULL`);
    }

    // Filtre par entite_id (pour sous-entités d'une entité)
    if (filters && filters.entite_id) {
      where.push(`se.entite_id = ?`);
      params.push(filters.entite_id);
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `se.${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY se.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY se.id ASC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} se`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE se.${COL_DELETED_AT} IS NULL`;
      }
      if (filters && filters.entite_id) {
        countSql += SOFT_DELETE ? ` AND se.entite_id = ?` : ` WHERE se.entite_id = ?`;
        countParams.push(filters.entite_id);
      }
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `se.${f} LIKE ?`).join(' OR ');
        countSql += (SOFT_DELETE || (filters && filters.entite_id)) ? ` AND (${conds})` : ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }
    return { rows, total };
  },

  /**
   * Récupérer une sous-entité par ID
   */
  async get({ id }) {
    const sql = `
      SELECT se.*, e.nom AS entite_nom, l.nom AS localite_nom
      FROM ${TABLE} se
      LEFT JOIN entites e ON se.entite_id = e.id
      LEFT JOIN localites l ON se.localite_id = l.id
      WHERE se.id = ? ${SOFT_DELETE ? `AND se.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une sous-entité
   */
  async add({ body }) {
    const { nom, code, entite_id, localite_id } = body;
    if (!nom || !code) {
      throw new Error('Champs "nom" et "code" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (nom, code, entite_id, localite_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      nom,
      code,
      entite_id || null,
      localite_id || null,
      now,
      now
    ]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour une sous-entité (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { nom, code, entite_id, localite_id } = body;
    const sql = `
      UPDATE ${TABLE}
      SET nom = ?, code = ?, entite_id = ?, localite_id = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      nom ?? existing.nom,
      code ?? existing.code,
      entite_id ?? existing.entite_id,
      localite_id ?? existing.localite_id,
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
      INSERT INTO ${TABLE} (nom, code, entite_id, localite_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.nom,
        item.code,
        item.entite_id || null,
        item.localite_id || null,
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
