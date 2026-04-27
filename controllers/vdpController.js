// src/controllers/vdpController.js
'use strict'

const db = require('../database/database')
const auditLogController = require('./auditLogController')

const TABLE = 'vdp'
const SEARCH_FIELDS = ['nom', 'prenom', 'matricule']
const SORTABLE_FIELDS = ['id', 'nom', 'created_at']
const SOFT_DELETE = true
const COL_DELETED_AT = 'deleted_at'
const COL_CREATED_AT = 'created_at'
const COL_UPDATED_AT = 'updated_at'

const nowISO = () => new Date().toISOString()

const controller = {
  /**
   * Liste paginée avec tri et recherche
   */
  async list({ listOpts }) {
    const { limit, offset, sortBy, sortDir, search } = listOpts || {}
    let sql = `SELECT * FROM ${TABLE} `
    const params = []
    const where = []

    if (SOFT_DELETE) {
      where.push(`${COL_DELETED_AT} IS NULL`)
    }

    if (search?.q) {
      const like = `%${search.q}%`
      where.push(`(${SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')})`)
      params.push(...SEARCH_FIELDS.map(() => like))
    }

    if (where.length) {
      sql += 'WHERE ' + where.join(' AND ') + ' '
    }

    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
      sql += `ORDER BY ${sortBy} ${sortDir === 'desc' ? 'DESC' : 'ASC'} `
    } else {
      sql += `ORDER BY nom ASC `
    }

    if (limit) {
      sql += `LIMIT ? OFFSET ?`
      params.push(limit, offset || 0)
    }

    const rows = await db.all(sql, params)

    // total pour pagination
    let total = rows.length
    if (limit) {
      let countSql = `SELECT COUNT(*) as cnt FROM ${TABLE}`
      const countParams = []

      if (SOFT_DELETE) {
        countSql += ` WHERE ${COL_DELETED_AT} IS NULL`
      }

      if (search?.q) {
        const like = `%${search.q}%`
        const conds = SEARCH_FIELDS.map(f => `${f} LIKE ?`).join(' OR ')
        countSql += SOFT_DELETE
          ? ` AND (${conds})`
          : ` WHERE (${conds})`
        countParams.push(...SEARCH_FIELDS.map(() => like))
      }

      const countRow = await db.get(countSql, countParams)
      total = countRow?.cnt || 0
    }

    return { rows, total }
  },

  /**
   * Récupérer un VDP par ID
   */
  async get({ id }) {
    const sql = `
      SELECT *
      FROM ${TABLE}
      WHERE id = ?
        ${SOFT_DELETE ? `AND ${COL_DELETED_AT} IS NULL` : ''}
    `
    return db.get(sql, [id])
  },

  /**
   * Ajouter un VDP (création)
   */
  async add({ body, currentUser }) {
    const { nom, prenom, matricule } = body
    if (!nom || !prenom || !matricule) {
      throw new Error('Champs "nom", "prenom" et "matricule" obligatoires')
    }

    const now = nowISO()
    const result = await db.run(
      `
      INSERT INTO ${TABLE}
        (nom, prenom, matricule, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
      `,
      [nom, prenom, matricule, now, now]
    )

    const newItem = await this.get({ id: result.lastID })

    // Audit log
    await auditLogController.add({
      body: {
        utilisateur_id: currentUser.id,
        action: 'CREATE',
        table_name: TABLE,
        record_id: newItem.id,
        details: JSON.stringify(newItem)
      }
    })

    return newItem
  },

  /**
   * Mettre à jour un VDP (PUT)
   */
  async update({ id, body, currentUser }) {
    const existing = await this.get({ id })
    if (!existing) return null

    const now = nowISO()
    const { nom, prenom, matricule } = body

    await db.run(
      `
      UPDATE ${TABLE}
      SET
        nom        = ?,
        prenom     = ?,
        matricule  = ?,
        ${COL_UPDATED_AT} = ?
      WHERE id = ?
      `,
      [
        nom ?? existing.nom,
        prenom ?? existing.prenom,
        matricule ?? existing.matricule,
        now,
        id
      ]
    )

    const updated = await this.get({ id })

    // Audit log
    await auditLogController.add({
      body: {
        utilisateur_id: currentUser.id,
        action: 'UPDATE',
        table_name: TABLE,
        record_id: updated.id,
        details: JSON.stringify(updated)
      }
    })

    return updated
  },

  /**
   * Mise à jour partielle (PATCH) → on délègue à update()
   */
  async patch(args) {
    return this.update(args)
  },

  /**
   * Suppression (soft delete)
   */
  async del({ id, soft, currentUser }) {
    const existing = await this.get({ id })
    if (!existing) return false

    if (SOFT_DELETE && soft !== false) {
      await db.run(
        `UPDATE ${TABLE} SET ${COL_DELETED_AT} = ? WHERE id = ?`,
        [nowISO(), id]
      )
    } else {
      await db.run(`DELETE FROM ${TABLE} WHERE id = ?`, [id])
    }

    // Audit log
    await auditLogController.add({
      body: {
        utilisateur_id: currentUser.id,
        action: 'DELETE',
        table_name: TABLE,
        record_id: id,
        details: JSON.stringify(existing)
      }
    })

    return true
  },

  /**
   * Ajout en masse
   */
  async bulkAdd({ items, currentUser }) {
    const now = nowISO()
    const sql = `
      INSERT INTO ${TABLE}
        (nom, prenom, matricule, ${COL_CREATED_AT}, ${COL_UPDATED_AT})
      VALUES (?, ?, ?, ?, ?)
    `
    const stmt = await db.prepare(sql)
    for (const item of items) {
      await stmt.run([
        item.nom,
        item.prenom,
        item.matricule,
        now,
        now
      ])
    }
    await stmt.finalize()

    // Audit log
    await auditLogController.add({
      body: {
        utilisateur_id: currentUser.id,
        action: 'BULK_CREATE',
        table_name: TABLE,
        record_id: null,
        details: JSON.stringify(items)
      }
    })

    return this.list({ listOpts: {} })
  },

  /**
   * Suppression en masse
   */
  async bulkDel({ ids, soft, currentUser }) {
    if (SOFT_DELETE && soft !== false) {
      await db.run(
        `UPDATE ${TABLE}
         SET ${COL_DELETED_AT} = ?
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        [nowISO(), ...ids]
      )
    } else {
      await db.run(
        `DELETE FROM ${TABLE} WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      )
    }

    // Audit log
    await auditLogController.add({
      body: {
        utilisateur_id: currentUser.id,
        action: 'BULK_DELETE',
        table_name: TABLE,
        record_id: null,
        details: JSON.stringify(ids)
      }
    })

    return { affected: ids.length }
  },

  /**
   * Handler pour le dashboard VDP : compte total + 10 derniers modifiés
   */
  async getDashboardVdp(req, res) {
    try {
      const totalRow = await db.get(
        `SELECT COUNT(*) AS cnt
         FROM ${TABLE}
         ${SOFT_DELETE ? `WHERE ${COL_DELETED_AT} IS NULL` : ''}`
      )
      const recent = await db.all(
        `
        SELECT *
        FROM ${TABLE}
        ${SOFT_DELETE ? `WHERE ${COL_DELETED_AT} IS NULL` : ''}
        ORDER BY ${COL_UPDATED_AT} DESC
        LIMIT 10
        `
      )
      res.json({
        total_vdp: totalRow?.cnt || 0,
        recent
      })
    } catch (err) {
      console.error('Erreur getDashboardVdp:', err)
      res.status(500).json({ error: err.message })
    }
  },

  /**
   * Handler pour les activités récentes VDP (juste la liste)
   */
  async getRecentActivities(req, res) {
    try {
      const rows = await db.all(
        `
        SELECT *
        FROM ${TABLE}
        ${SOFT_DELETE ? `WHERE ${COL_DELETED_AT} IS NULL` : ''}
        ORDER BY ${COL_UPDATED_AT} DESC
        LIMIT 10
        `
      )
      res.json({ recent: rows })
    } catch (err) {
      console.error('Erreur getRecentActivities VDP:', err)
      res.status(500).json({ error: err.message })
    }
  }
}

// Export principal
module.exports = controller

// Export explicite des dashboards pour lier en main.js
module.exports.getDashboardVdp       = controller.getDashboardVdp
module.exports.getRecentActivities  = controller.getRecentActivities
