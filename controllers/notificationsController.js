// controllers/notificationsController.js
'use strict';

const db = require('../database/database');

const TABLE = 'notifications';

// Colonnes autorisées pour tri/recherche
const SEARCH_FIELDS = ['titre', 'message', 'type'];
const SORTABLE_FIELDS = ['id', 'date_notification', 'created_at'];

// Soft delete et timestamps
const SOFT_DELETE = true;
const COL_DELETED_AT = 'deleted_at';
const COL_CREATED_AT = 'created_at';
const COL_UPDATED_AT = 'updated_at';

const nowISO = () => new Date().toISOString();

module.exports = {
  async list({ listOpts }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};
    let sql = `SELECT * FROM ${TABLE}`;
    const params = [];
    const where = [];

    if (SOFT_DELETE) where.push(`${COL_DELETED_AT} IS NULL`);
    if (search?.q) {
      const like = `%${search.q}%`;
      where.push(`(${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`);
      params.push(...SEARCH_FIELDS.map(() => like));
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');

    sql += sortBy && SORTABLE_FIELDS.includes(sortBy)
      ? ` ORDER BY ${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`
      : ` ORDER BY date_notification DESC`;

    if (limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset || 0);
    }

    const rows = await db.all(sql, params);
    let total = rows.length;
    if (limit) {
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE}`;
      const countParams = [];
      if (SOFT_DELETE) countSql += ` WHERE ${COL_DELETED_AT} IS NULL`;
      if (search?.q) {
        const like = `%${search.q}%`;
        countSql += SOFT_DELETE ? ` AND (${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`
                                : ` WHERE (${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`;
        countParams.push(...SEARCH_FIELDS.map(() => like));
      }
      const countRow = await db.get(countSql, countParams);
      total = countRow?.cnt || 0;
    }
    return { rows, total };
  },

  async get({ id }) {
    return db.get(
      `SELECT * FROM ${TABLE} WHERE id = ? ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}`,
      [id]
    );
  },

  async add({ body }) {
    const { titre, message, type, date_notification } = body;
    if (!titre || !message) {
      throw new Error('Champs "titre" et "message" obligatoires');
    }

    const now = nowISO();
    const result = await db.run(
      `INSERT INTO ${TABLE} (titre, message, type, date_notification, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
       VALUES (?, ?, ?, ?, ?, ?)`,
      [titre, message, type || '', date_notification || now, now, now]
    );
    return this.get({ id: result.lastID });
  },

  async update({ id, body }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const { titre, message, type, date_notification } = body;
    await db.run(
      `UPDATE ${TABLE}
       SET titre = ?, message = ?, type = ?, date_notification = ?, ${COL_UPDATED_AT} = ?
       WHERE id = ?`,
      [
        titre ?? existing.titre,
        message ?? existing.message,
        type ?? existing.type,
        date_notification ?? existing.date_notification,
        nowISO(),
        id
      ]
    );
    return this.get({ id });
  },

  async patch({ id, body }) {
    return this.update({ id, body });
  },

  async del({ id, soft }) {
    if (SOFT_DELETE && soft !== false) {
      await db.run(`UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id = ?`, [nowISO(), id]);
    } else {
      await db.run(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    }
    return true;
  },

  async bulkAdd({ items }) {
    const now = nowISO();
    const stmt = await db.prepare(
      `INSERT INTO ${TABLE} (titre, message, type, date_notification, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      await stmt.run([
        item.titre,
        item.message,
        item.type || '',
        item.date_notification || now,
        now,
        now
      ]);
    }
    await stmt.finalize();
    return this.list({ listOpts: {} });
  },

  async bulkDel({ ids, soft }) {
    if (SOFT_DELETE && soft !== false) {
      await db.run(`UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [nowISO(), ...ids]);
    } else {
      await db.run(`DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    }
    return { affected: ids.length };
  }
};
