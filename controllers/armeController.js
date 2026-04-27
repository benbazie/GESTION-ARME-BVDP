// src/controllers/armeController.js
'use strict';

const db = require('../database/database');
const auditLogController = require('./auditLogController');

const TABLE           = 'armes';
const SEARCH_FIELDS   = ['a.numero_serie', 'a.nom', 'a.type'];
const SORTABLE_FIELDS = ['a.id', 'a.numero_serie', 'a.nom', 'a.type', 'a.created_at'];
const SOFT_DELETE     = true;
const COL_DELETED_AT  = 'deleted_at';
const COL_CREATED_AT  = 'created_at';
const COL_UPDATED_AT  = 'updated_at';

const nowISO = () => new Date().toISOString();

// Normalize ownership and nullify unrelated fields
function normalizeOwnershipPayload(body) {
  const p = { ...body };
  if (p.ownership_type === 'entite') {
    p.region_id = null; p.province_id = null; p.commune_id = null; p.localite_id = null;
  } else if (p.ownership_type === 'region') {
    p.entite_id = null; p.sous_entite_id = null;
  } else {
    // Backward compatibility: infer ownership_type if missing
    if (p.entite_id) p.ownership_type = 'entite';
    else if (p.region_id) p.ownership_type = 'region';
  }
  return p;
}

// Validate required fields according to ownership_type
function validateArmePayload(body) {
  if (!body) {
    const err = new Error('Body vide');
    err.status = 400;
    throw err;
  }
  if (!body.numero_serie) {
    const err = new Error('numero_serie requis');
    err.status = 400;
    throw err;
  }
  if (!body.nom) {
    const err = new Error('nom requis');
    err.status = 400;
    throw err;
  }
  if (!body.type) {
    const err = new Error('type requis');
    err.status = 400;
    throw err;
  }
  const ownership = body.ownership_type;
  if (!ownership || !['entite','region'].includes(ownership)) {
    const err = new Error('ownership_type must be "entite" or "region"');
    err.status = 400;
    throw err;
  }
  if (ownership === 'entite' && !body.entite_id) {
    const err = new Error('entite_id required when ownership_type = entite');
    err.status = 400;
    throw err;
  }
  if (ownership === 'region' && !body.region_id) {
    const err = new Error('region_id required when ownership_type = region');
    err.status = 400;
    throw err;
  }
  return true;
}

// Compute delta of changed fields (ignore innocuous fields)
function computeDelta(before = {}, after = {}) {
  const ignored = new Set(['updated_at','created_at','synced','uuid']);
  const delta = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.forEach((k) => {
    if (ignored.has(k)) return;
    const bv = before[k] === undefined ? null : before[k];
    const av = after[k] === undefined ? null : after[k];
    if (String(bv) !== String(av)) delta[k] = { old: bv, new: av };
  });
  return delta;
}

// Helper to run a DB transaction for a client that provides run/get/all returning Promises
async function withTransaction(fn) {
  try {
    await db.run('BEGIN TRANSACTION');
    const res = await fn();
    await db.run('COMMIT');
    return res;
  } catch (err) {
    await db.run('ROLLBACK').catch(()=>{});
    throw err;
  }
}

module.exports = {
  /**
   * Liste paginée + tri + recherche, jointure config_arme & lots & entite/region
   * listOpts: { limit, offset, sortBy, sortDir, search: { q } }
   */
  async list({ listOpts }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {};

    let sql = `
      SELECT
        a.*,
        c.type         AS config_type,
        c.categorie    AS config_categorie,
        c.designation  AS config_designation,
        l.designation  AS lot_designation,
        e.nom          AS entite_nom,
        r.nom          AS region_nom
      FROM ${TABLE} a
      LEFT JOIN config_arme c ON a.config_arme_id = c.id
      LEFT JOIN lots l         ON a.lot = l.id
      LEFT JOIN entites e      ON a.entite_id = e.id
      LEFT JOIN regions r      ON a.region_id = r.id
    `;

    const params = [];
    const where  = [];

    if (SOFT_DELETE) where.push(`a.${COL_DELETED_AT} IS NULL`);

    if (search?.q) {
      const like = `%${search.q}%`;
      where.push('(' + SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ') + ')');
      SEARCH_FIELDS.forEach(() => params.push(like));
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');

    if (sortBy && SORTABLE_FIELDS.includes(`a.${sortBy}`)) {
      sql += ` ORDER BY a.${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      sql += ` ORDER BY a.numero_serie ASC`;
    }

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset || 0);
    }

    const rows = await db.all(sql, params);

    let total = rows.length;
    if (limit) {
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE} a`;
      const countArgs = [];
      if (SOFT_DELETE) countSql += ` WHERE a.${COL_DELETED_AT} IS NULL`;
      if (search?.q) {
        const like = `%${search.q}%`;
        countSql += countArgs.length
          ? ` AND (${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`
          : ` WHERE (${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`;
        SEARCH_FIELDS.forEach(() => countArgs.push(like));
      }
      const countRow = await db.get(countSql, countArgs);
      total = countRow?.cnt || 0;
    }

    return { rows, total };
  },

  /**
   * Détail d’une arme par ID
   */
  async get({ id }) {
    const sql = `
      SELECT
        a.*,
        c.type         AS config_type,
        c.categorie    AS config_categorie,
        c.designation  AS config_designation,
        l.designation  AS lot_designation,
        e.nom          AS entite_nom,
        se.nom         AS sous_entite_nom,
        r.nom          AS region_nom,
        p.nom          AS province_nom,
        com.nom        AS commune_nom
      FROM ${TABLE} a
      LEFT JOIN config_arme c ON a.config_arme_id = c.id
      LEFT JOIN lots l         ON a.lot = l.id
      LEFT JOIN entites e      ON a.entite_id = e.id
      LEFT JOIN sous_entites se ON a.sous_entite_id = se.id
      LEFT JOIN regions r      ON a.region_id = r.id
      LEFT JOIN provinces p    ON a.province_id = p.id
      LEFT JOIN communes com   ON a.commune_id = com.id
      WHERE a.id = ?
      ${SOFT_DELETE ? `AND a.${COL_DELETED_AT} IS NULL` : ''}
    `;
    return db.get(sql, [id]);
  },

  /**
   * Création d’une arme (transactionnelle + audit)
   * args: { body, currentUser }
   */
  async add({ body, currentUser }) {
    const payload = normalizeOwnershipPayload(body);
    validateArmePayload(payload);

    const actor = (currentUser && (currentUser.id || currentUser.user_id)) ? currentUser : null;

    return await withTransaction(async () => {
      const now = nowISO();
      const insertSql = `
        INSERT INTO ${TABLE} (
          numero_serie, nom, type, date_entree, statut,
          config_arme_id, lot, ownership_type, entite_id, sous_entite_id,
          region_id, province_id, commune_id, localite_id,
          created_by, created_by_name, ${COL_CREATED_AT}, ${COL_UPDATED_AT}
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;
      const params = [
        payload.numero_serie,
        payload.nom,
        payload.type,
        payload.date_entree || null,
        payload.statut || null,
        payload.config_arme_id || null,
        payload.lot || null,
        payload.ownership_type || (payload.entite_id ? 'entite' : (payload.region_id ? 'region' : null)),
        payload.entite_id || null,
        payload.sous_entite_id || null,
        payload.region_id || null,
        payload.province_id || null,
        payload.commune_id || null,
        payload.localite_id || null,
        actor?.id || null,
        actor?.username || actor?.name || null,
        now, now
      ];

      const result = await db.run(insertSql, params);
      const newItem = await this.get({ id: result.lastID });

      // Audit
      await auditLogController.add({
        body: {
          utilisateur_id: actor?.id || null,
          action:         'CREATE',
          table_name:     TABLE,
          record_id:      newItem.id,
          details:        JSON.stringify({ after: newItem })
        }
      });

      return newItem;
    });
  },

  /**
   * Mise à jour (PUT) transactionnelle + audit
   * args: { id, body, currentUser }
   */
  async update({ id, body, currentUser }) {
    const existing = await this.get({ id });
    if (!existing) return null;

    const payload = normalizeOwnershipPayload(body);
    validateArmePayload({ ...existing, ...payload }); // ensure combined validity

    const actor = (currentUser && (currentUser.id || currentUser.user_id)) ? currentUser : null;

    return await withTransaction(async () => {
      const updateSql = `
        UPDATE ${TABLE}
        SET
          numero_serie   = ?,
          nom            = ?,
          type           = ?,
          date_entree    = ?,
          statut         = ?,
          config_arme_id = ?,
          lot            = ?,
          ownership_type = ?,
          entite_id      = ?,
          sous_entite_id = ?,
          region_id      = ?,
          province_id    = ?,
          commune_id     = ?,
          localite_id    = ?,
          updated_by     = ?,
          updated_by_name= ?,
          ${COL_UPDATED_AT} = ?
        WHERE id = ?
      `;
      const params = [
        payload.numero_serie ?? existing.numero_serie,
        payload.nom ?? existing.nom,
        payload.type ?? existing.type,
        payload.date_entree ?? existing.date_entree,
        payload.statut ?? existing.statut,
        payload.config_arme_id ?? existing.config_arme_id,
        payload.lot ?? existing.lot,
        payload.ownership_type ?? existing.ownership_type,
        payload.entite_id ?? existing.entite_id,
        payload.sous_entite_id ?? existing.sous_entite_id,
        payload.region_id ?? existing.region_id,
        payload.province_id ?? existing.province_id,
        payload.commune_id ?? existing.commune_id,
        payload.localite_id ?? existing.localite_id,
        actor?.id || null,
        actor?.username || actor?.name || null,
        nowISO(),
        id
      ];

      await db.run(updateSql, params);
      const updated = await this.get({ id });

      const delta = computeDelta(existing, updated);

      await auditLogController.add({
        body: {
          utilisateur_id: actor?.id || null,
          action:         'UPDATE',
          table_name:     TABLE,
          record_id:      updated.id,
          details:        JSON.stringify({ before: existing, after: updated, delta })
        }
      });

      return updated;
    });
  },

  /**
   * Patch = update
   */
  async patch(args) {
    return this.update(args);
  },

  /**
   * Suppression (soft-delete par défaut) + audit
   * args: { id, soft = true, currentUser }
   */
  async del({ id, soft = true, currentUser }) {
    const existing = await this.get({ id });
    if (!existing) return false;

    const actor = (currentUser && (currentUser.id || currentUser.user_id)) ? currentUser : null;

    return await withTransaction(async () => {
      if (SOFT_DELETE && soft !== false) {
        await db.run(
          `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ?, deleted_by = ?, deleted_by_name = ? WHERE id = ?`,
          [nowISO(), actor?.id || null, actor?.username || actor?.name || null, id]
        );
      } else {
        await db.run(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
      }

      await auditLogController.add({
        body: {
          utilisateur_id: actor?.id || null,
          action:         'DELETE',
          table_name:     TABLE,
          record_id:      id,
          details:        JSON.stringify({ before: existing })
        }
      });

      return true;
    });
  },

  /**
   * Bulk add (transactionnel) - items: array of payloads
   */
  async bulkAdd({ items, currentUser }) {
    if (!Array.isArray(items) || !items.length) return { rows: [], total: 0 };
    const actor = (currentUser && (currentUser.id || currentUser.user_id)) ? currentUser : null;

    return await withTransaction(async () => {
      const now = nowISO();
      const stmt = await db.prepare(
        `INSERT INTO ${TABLE} (
          numero_serie, nom, type, date_entree, statut,
          config_arme_id, lot, ownership_type, entite_id, sous_entite_id,
          region_id, province_id, commune_id, localite_id,
          created_by, created_by_name, ${COL_CREATED_AT}, ${COL_UPDATED_AT}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const itRaw of items) {
        const it = normalizeOwnershipPayload(itRaw);
        validateArmePayload(it);
        await stmt.run([
          it.numero_serie,
          it.nom,
          it.type,
          it.date_entree || null,
          it.statut || null,
          it.config_arme_id || null,
          it.lot || null,
          it.ownership_type || (it.entite_id ? 'entite' : (it.region_id ? 'region' : null)),
          it.entite_id || null,
          it.sous_entite_id || null,
          it.region_id || null,
          it.province_id || null,
          it.commune_id || null,
          it.localite_id || null,
          actor?.id || null,
          actor?.username || actor?.name || null,
          now, now
        ]);
      }
      await stmt.finalize();

      await auditLogController.add({
        body: {
          utilisateur_id: actor?.id || null,
          action:         'BULK_CREATE',
          table_name:     TABLE,
          record_id:      null,
          details:        JSON.stringify({ count: items.length })
        }
      });

      return this.list({ listOpts: {} });
    });
  },

  /**
   * Bulk delete (transactionnel)
   */
  async bulkDel({ ids, soft = true, currentUser }) {
    if (!Array.isArray(ids) || !ids.length) return { affected: 0 };
    const actor = (currentUser && (currentUser.id || currentUser.user_id)) ? currentUser : null;

    return await withTransaction(async () => {
      if (SOFT_DELETE && soft !== false) {
        await db.run(
          `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ?, deleted_by = ?, deleted_by_name = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
          [nowISO(), actor?.id || null, actor?.username || actor?.name || null, ...ids]
        );
      } else {
        await db.run(`DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      }

      await auditLogController.add({
        body: {
          utilisateur_id: actor?.id || null,
          action:         'BULK_DELETE',
          table_name:     TABLE,
          record_id:      null,
          details:        JSON.stringify({ ids })
        }
      });

      return { affected: ids.length };
    });
  },

  /**
   * Dashboard armes (résumé)
   */
  async getDashboardArmes() {
    const totalRow = await db.get(`SELECT COUNT(*) AS cnt FROM ${TABLE} WHERE ${COL_DELETED_AT} IS NULL`);
    const recent = await db.all(
      `
      SELECT
        a.*,
        c.type AS config_type,
        c.categorie AS config_categorie,
        l.designation AS lot_designation
      FROM ${TABLE} a
      LEFT JOIN config_arme c ON a.config_arme_id = c.id
      LEFT JOIN lots l         ON a.lot = l.id
      WHERE a.${COL_DELETED_AT} IS NULL
      ORDER BY a.${COL_CREATED_AT} DESC
      LIMIT 10
      `
    );

    return { total_armes: totalRow?.cnt || 0, recent };
  }
};
