// controllers/munitionsController.js
'use strict';

const db = require('../database/database');

const TABLE = 'munitions';

// Colonnes autorisÃ©es pour tri/recherche
const SEARCH_FIELDS = ['type', 'calibre', 'lot_code'];
const SORTABLE_FIELDS = ['id', 'type', 'calibre', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  /**
   * Liste paginÃ©e avec tri/recherche
   */
  async list({ listOpts }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `SELECT * FROM ${TABLE}`;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`${COL_DELETED_AT} IS NULL`);
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
      sql += ` ORDER BY ${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY type ASC`;
    }

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
   * RÃ©cupÃ©rer une munition par ID
   */
  async get({ id }) {
    const sql = `SELECT * FROM ${TABLE} WHERE id = ? ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}`;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une munition
   */
  async add({ body }) {
    const { type, calibre, lot_code } = body;
    if (!type || !calibre) {
      throw new Error('Champs "type" et "calibre" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (type, calibre, lot_code, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [type, calibre, lot_code || '', now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre Ã  jour une munition (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { type, calibre, lot_code } = body;
    const sql = `
      UPDATE ${TABLE}
      SET type = ?, calibre = ?, lot_code = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      type ?? existing.type,
      calibre ?? existing.calibre,
      lot_code ?? existing.lot_code,
      nowISO(),
      id
    ]);

    return this.get({ id });
  },

  /**
   * Mise Ã  jour partielle (PATCH)
   */
  async patch({ id, body }) {
    return this.update({ id, body });
  },

  /**
   * Suppression (soft delete si activÃ©)
   */
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

  /**
   * Ajout en masse
   */
  async bulkAdd({ items }) {
    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (type, calibre, lot_code, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.type,
        item.calibre,
        item.lot_code || '',
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
module.exports.getDashboardMunitions = async (req, res) => {
  try {
    const total = await db.get(`SELECT COUNT(*) as cnt FROM munition`);
    const recent = await db.all(
      `SELECT * FROM munition ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ total_munitions: total?.cnt || 0, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

