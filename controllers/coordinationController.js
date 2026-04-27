// controllers/coordinationController.js
'use strict';

const { db } = require('../database/database');

// Helpers pour chaque niveau
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
}

module.exports = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT c.*
      FROM ${TABLE} c
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`c.${COL_DELETED_AT} IS NULL`);
    }

    // Filtre par parent_id (pour sous-coordination)
    if (filters && filters.parent_id) {
      where.push(`c.parent_id = ?`);
      params.push(filters.parent_id);
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `c.${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY c.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY c.nom ASC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} c`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE c.${COL_DELETED_AT} IS NULL`;
      }
      if (filters && filters.parent_id) {
        countSql += SOFT_DELETE ? ` AND c.parent_id = ?` : ` WHERE c.parent_id = ?`;
        countParams.push(filters.parent_id);
      }
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `c.${f} LIKE ?`).join(' OR ');
        countSql += SOFT_DELETE || (filters && filters.parent_id) ? ` AND (${conds})` : ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Récupérer une coordination par ID
   */
  async get({ id }) {
    const sql = `
      SELECT c.*
      FROM ${TABLE} c
      WHERE c.id = ? ${SOFT_DELETE ? `AND c.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter une coordination
   */
  async add({ body }) {
    const { nom, code, localite_id } = body;
    if (!nom || !code) {
      throw new Error('Champs "nom" et "code" obligatoires');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (nom, code, localite_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [nom, code, localite_id || null, now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour une coordination (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { nom, code } = body;
    const sql = `
      UPDATE ${TABLE}
      SET nom = ?, code = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      nom ?? existing.nom,
      code ?? existing.code,
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
      INSERT INTO ${TABLE} (nom, code, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.nom,
        item.code,
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
  },

  // --- Régionaux ---
  async listRegionale() {
    return all(`SELECT cr.*, r.nom AS region_nom FROM coordination_regionale cr LEFT JOIN regions r ON cr.region_id = r.id`);
  },
  async getRegionale(id) {
    return get(`SELECT * FROM coordination_regionale WHERE id = ?`, [id]);
  },
  async createRegionale(data) {
    const { nom, code, region_id, description } = data;
    return run(`INSERT INTO coordination_regionale (nom, code, region_id, description) VALUES (?, ?, ?, ?)`, [nom, code, region_id, description]);
  },
  async updateRegionale(id, data) {
    const { nom, code, region_id, description } = data;
    return run(`UPDATE coordination_regionale SET nom=?, code=?, region_id=?, description=? WHERE id=?`, [nom, code, region_id, description, id]);
  },
  async deleteRegionale(id) {
    return run(`DELETE FROM coordination_regionale WHERE id=?`, [id]);
  },

  // --- Provinciales ---
  async listProvinciale(regionale_id) {
    return all(`SELECT cp.*, p.nom AS province_nom FROM coordination_provinciale cp LEFT JOIN provinces p ON cp.province_id = p.id WHERE cp.parent_id = ?`, [regionale_id]);
  },
  async getProvinciale(id) {
    return get(`SELECT * FROM coordination_provinciale WHERE id = ?`, [id]);
  },
  async createProvinciale(data) {
    const { nom, code, province_id, region_id, parent_id, description } = data;
    return run(`INSERT INTO coordination_provinciale (nom, code, province_id, region_id, parent_id, description) VALUES (?, ?, ?, ?, ?, ?)`, [nom, code, province_id, region_id, parent_id, description]);
  },
  async updateProvinciale(id, data) {
    const { nom, code, province_id, region_id, parent_id, description } = data;
    return run(`UPDATE coordination_provinciale SET nom=?, code=?, province_id=?, region_id=?, parent_id=?, description=? WHERE id=?`, [nom, code, province_id, region_id, parent_id, description, id]);
  },
  async deleteProvinciale(id) {
    return run(`DELETE FROM coordination_provinciale WHERE id=?`, [id]);
  },

  // --- Communales ---
  async listCommunale(provinciale_id) {
    return all(`SELECT cc.*, c.nom AS commune_nom FROM coordination_communale cc LEFT JOIN communes c ON cc.commune_id = c.id WHERE cc.parent_id = ?`, [provinciale_id]);
  },
  async getCommunale(id) {
    return get(`SELECT * FROM coordination_communale WHERE id = ?`, [id]);
  },
  async createCommunale(data) {
    const { nom, code, commune_id, province_id, region_id, parent_id, description } = data;
    return run(`INSERT INTO coordination_communale (nom, code, commune_id, province_id, region_id, parent_id, description) VALUES (?, ?, ?, ?, ?, ?, ?)`, [nom, code, commune_id, province_id, region_id, parent_id, description]);
  },
  async updateCommunale(id, data) {
    const { nom, code, commune_id, province_id, region_id, parent_id, description } = data;
    return run(`UPDATE coordination_communale SET nom=?, code=?, commune_id=?, province_id=?, region_id=?, parent_id=?, description=? WHERE id=?`, [nom, code, commune_id, province_id, region_id, parent_id, description, id]);
  },
  async deleteCommunale(id) {
    return run(`DELETE FROM coordination_communale WHERE id=?`, [id]);
  },

  // --- Localités liées à une coordination communale ---
  async listLocalites(coordination_commune_id) {
    return all(`SELECT lc.*, l.nom AS localite_nom FROM localite_coordination lc LEFT JOIN localites l ON lc.localite_id = l.id WHERE lc.coordination_commune_id = ?`, [coordination_commune_id]);
  },
  async addLocalite(data) {
    const { localite_id, coordination_commune_id } = data;
    return run(`INSERT INTO localite_coordination (localite_id, coordination_commune_id) VALUES (?, ?)`, [localite_id, coordination_commune_id]);
  },
  async removeLocalite(id) {
    return run(`DELETE FROM localite_coordination WHERE id=?`, [id]);
  }
};
