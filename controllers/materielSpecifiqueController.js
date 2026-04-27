// controllers/materielSpecifiqueController.js
'use strict';

const db = require('../database/database');

const TABLE = 'materiel_specifique';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['designation', 'categorie', 'numero_serie'];
const SORTABLE_FIELDS = ['id', 'designation', 'categorie', 'created_at'];

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
   * Récupérer un matériel spécifique par ID
   */
  async get({ id }) {
    const sql = `SELECT * FROM ${TABLE} WHERE id = ? ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}`;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter un matériel spécifique
   */
  async add({ body }) {
    const { designation, categorie, numero_serie } = body;
    if (!designation || !categorie) {
      throw new Error('Champs "designation" et "categorie" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (designation, categorie, numero_serie, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [designation, categorie, numero_serie || '', now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour un matériel spécifique (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { designation, categorie, numero_serie } = body;
    const sql = `
      UPDATE ${TABLE}
      SET designation = ?, categorie = ?, numero_serie = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      designation ?? existing.designation,
      categorie ?? existing.categorie,
      numero_serie ?? existing.numero_serie,
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
      INSERT INTO ${TABLE} (designation, categorie, numero_serie, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.designation,
        item.categorie,
        item.numero_serie || '',
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
module.exports.getDashboardMateriel = async (req, res) => {
  try {
    const total = await db.get(`SELECT COUNT(*) as cnt FROM materiel_specifique`);
    const recent = await db.all(
      `SELECT * FROM materiel_specifique ORDER BY created_at DESC LIMIT 10`
    );
    res.json({ total_materiel_specifique: total?.cnt || 0, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
