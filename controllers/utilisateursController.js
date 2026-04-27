// controllers/utilisateursController.js
'use strict';

const db = require('../database/database');

const TABLE = 'utilisateurs';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['nom', 'prenom', 'email', 'username'];
const SORTABLE_FIELDS = ['id', 'nom', 'prenom', 'email', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

const controller = {
  /**
   * Liste paginée avec tri/recherche
   */
  async list({ listOpts, filters }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT u.*, r.nom AS role_nom
      FROM ${TABLE} u
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    const params = [];
    const where = [];

    if (SOFT_DELETE) {
      where.push(`u.${COL_DELETED_AT} IS NULL`);
    }

    // Recherche
    if (search?.q) {
      const like = `%${search.q}%`;
      const conds = SEARCH_FIELDS.map(f => `u.${f} LIKE ?`).join(' OR ');
      where.push(`(${conds})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Tri
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += ` ORDER BY u.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY u.id ASC`;
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
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} u`;
      const countParams = [];
      if (SOFT_DELETE) {
        countSql += ` WHERE u.${COL_DELETED_AT} IS NULL`;
      }
      if (search?.q) {
        const like = `%${search.q}%`;
        const conds = SEARCH_FIELDS.map(f => `u.${f} LIKE ?`).join(' OR ');
        countSql += SOFT_DELETE ? ` AND (${conds})` : ` WHERE (${conds})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Récupérer un utilisateur par ID
   */
  async get({ id }) {
    const sql = `
      SELECT u.*, r.nom AS role_nom
      FROM ${TABLE} u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? ${SOFT_DELETE ? `AND u.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Ajouter un utilisateur
   */
  async add({ body }) {
    const { nom, prenom, email, username, password_hash, role_id } = body;
    if (!nom || !prenom || !email || !username || !password_hash) {
      throw new Error('Champs obligatoires manquants');
    }

    const now = nowISO();
    const sql = `
      INSERT INTO ${TABLE} (nom, prenom, email, username, password_hash, role_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [nom, prenom, email, username, password_hash, role_id || null, now, now]);

    return this.get({ id: result.lastID });
  },

  /**
   * Mettre à jour un utilisateur (PUT)
   */
  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { nom, prenom, email, username, password_hash, role_id } = body;
    const sql = `
      UPDATE ${TABLE}
      SET nom = ?, prenom = ?, email = ?, username = ?, password_hash = ?, role_id = ?, ${COL_UPDATED_AT} = ?
      WHERE id = ?
    `;
    await db.run(sql, [
      nom ?? existing.nom,
      prenom ?? existing.prenom,
      email ?? existing.email,
      username ?? existing.username,
      password_hash ?? existing.password_hash,
      role_id ?? existing.role_id,
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
      INSERT INTO ${TABLE} (nom, prenom, email, username, password_hash, role_id, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const stmt = await db.prepare(sql);
    for (const item of items) {
      await stmt.run([
        item.nom,
        item.prenom,
        item.email,
        item.username,
        item.password_hash,
        item.role_id || null,
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

controller.getUtilisateurs = async function (arg = {}) {
  const listOpts = arg && arg.listOpts ? arg.listOpts : arg;
  const { rows } = await controller.list({ listOpts });
  return rows;
};
controller.getUtilisateursList = controller.getUtilisateurs;

controller.getUtilisateur = async function (arg) {
  const id = typeof arg === "number" ? arg : Number(arg?.id);
  if (!Number.isFinite(id)) return null;
  return controller.get({ id });
};
controller.getUtilisateurById = controller.getUtilisateur;

controller.addUtilisateur = async function (payload) {
  if (payload && payload.body) return controller.add(payload);
  return controller.add({ body: payload });
};
controller.createUtilisateur = controller.addUtilisateur;
controller.createUtilisateurs = controller.addUtilisateur;

controller.updateUtilisateur = async function (payload = {}) {
  const id = payload.id ?? payload.body?.id;
  const body = payload.body ?? payload;
  if (id == null || !body) return null;
  return controller.update({ id, body });
};
controller.updateUtilisateurs = controller.updateUtilisateur;

controller.deleteUtilisateur = async function (payload) {
  const id = typeof payload === "number" ? payload : payload?.id;
  if (id == null) return controller.del(payload || {});
  const soft = typeof payload === "object" ? payload.soft : undefined;
  return controller.del({ id, soft });
};
controller.deleteUtilisateurs = controller.deleteUtilisateur;
controller.removeUtilisateur = controller.deleteUtilisateur;

module.exports = controller;
