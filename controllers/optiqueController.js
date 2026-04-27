// controllers/optiquesController.js
'use strict';

const db = require('../database/database');

const TABLE = 'optiques';

// Colonnes autorisÃ©es pour tri/recherche
const SEARCH_FIELDS = ['designation', 'marque', 'modele'];
const SORTABLE_FIELDS = ['id', 'designation', 'marque', 'modele', 'created_at'];

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
      sql += ` ORDER BY designation ASC`;
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
   * RÃ©cupÃ©rer une optique par ID
   */
  async get({ id }) {
    const sql = `SELECT * FROM ${TABLE} WHERE id = ? ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}`;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une optique
   */
  async add({ body }) {
    const { designation, marque, modele } = body;
    if (!designation || !marque) {
      throw new Error('Champs "designation" et "marque" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (designation, marque, modele, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [designation, marque, modele || '', now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre Ã  jour une optique (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { designation, marque, modele } = body;
    const sql = `
      UPDATE ${TABLE}
      SET designation = ?, marque = ?, modele = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      designation ?? existing.designation,
      marque ?? existing.marque,
      modele ?? existing.modele,
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
      INSERT INTO ${TABLE} (designation, marque, modele, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.designation,
        item.marque,
        item.modele || '',
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
module.exports.getDashboardOptiques = async (req, res) => {
  try {
    const total = await db.get(`SELECT COUNT(*) as cnt FROM optique`);
    const recent = await db.all(
      `SELECT * FROM optique ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ total_optiques: total?.cnt || 0, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

