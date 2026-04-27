// controllers/dotationOptiqueController.js
'use strict';

const db = require('../database/database');

const TABLE = 'dotation_optiques';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['optique_numero_serie', 'vdp_nom', 'lot_code'];
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
      SELECT do.*, 
             o.numero_serie AS optique_numero_serie,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} do
      LEFT JOIN optiques o ON do.optique_id = o.id
      LEFT JOIN vdp v ON do.vdp_id = v.id
      LEFT JOIN lots l ON do.lot_id = l.id
      LEFT JOIN entites e ON do.entite_id = e.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`do.${COL_DELETED_AT} IS NULL`);
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
      sql += ` ORDER BY do.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY do.date_dotation DESC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} do`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE do.${COL_DELETED_AT} IS NULL`;
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
   * Récupérer une dotation d’optique par ID
   */
  async get({ id }) {
    const sql = `
      SELECT do.*, 
             o.numero_serie AS optique_numero_serie,
             v.nom AS vdp_nom,
             l.code AS lot_code,
             e.nom AS entite_nom
      FROM ${TABLE} do
      LEFT JOIN optiques o ON do.optique_id = o.id
      LEFT JOIN vdp v ON do.vdp_id = v.id
      LEFT JOIN lots l ON do.lot_id = l.id
      LEFT JOIN entites e ON do.entite_id = e.id
      WHERE do.id = ? ${SOFT_DELETE ? `AND do.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une dotation d’optique
   */
  async add({ body }) {
    const { optique_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    if (!optique_id || !vdp_id || !lot_id || !entite_id) {
      throw new Error('Champs "optique_id", "vdp_id", "lot_id" et "entite_id" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (optique_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      optique_id,
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
   * Mettre à jour une dotation d’optique (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { optique_id, vdp_id, lot_id, entite_id, date_dotation } = body;
    const sql = `
      UPDATE ${TABLE}
      SET optique_id = ?, vdp_id = ?, lot_id = ?, entite_id = ?, date_dotation = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      optique_id ?? existing.optique_id,
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
      INSERT INTO ${TABLE} (optique_id, vdp_id, lot_id, entite_id, date_dotation, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.optique_id,
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
