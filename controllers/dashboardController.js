// controllers/dashboardController.js
'use strict'

const dbModule = require('../database/database')
const db = dbModule.db

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
  )

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)))
  )

const sumValues = rows =>
  rows.reduce((acc, row) => acc + (Number(row?.value) || 0), 0)

const wrap = handler => async (req, res) => {
  try {
    res.json(await handler(req))
  } catch (err) {
    console.error('[dashboardController]', err)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  totalArmes: wrap(async () => {
    const row = await dbGet(`SELECT COUNT(*) AS total FROM armes WHERE deleted_at IS NULL`)
    return { total: row?.total || 0 }
  }),

  summaryMunitions: wrap(async () => {
    const rows = await dbAll(
      `SELECT COALESCE(cm.designation,'Inconnu') AS name,
              SUM(COALESCE(m.balance,0))            AS value
       FROM munitions m
       LEFT JOIN config_munition cm ON cm.id = m.config_munition_id
       WHERE m.deleted_at IS NULL
       GROUP BY cm.designation
       ORDER BY name`
    )
    return { total: sumValues(rows), rows }
  }),

  summaryMateriel: wrap(async () => {
    const rows = await dbAll(
      `SELECT COALESCE(cm.designation,'Inconnu') AS name,
              COUNT(ms.id)                       AS value
       FROM materiels_specifiques ms
       LEFT JOIN config_materiel cm ON cm.id = ms.config_materiel_id
       WHERE ms.deleted_at IS NULL
       GROUP BY cm.designation
       ORDER BY name`
    )
    return { total: sumValues(rows), rows }
  }),

  totalDotations: wrap(async () => {
    const row = await dbGet(`SELECT COUNT(*) AS total FROM dotations WHERE deleted_at IS NULL`)
    return { total: row?.total || 0 }
  }),

  totalVdp: wrap(async () => {
    const row = await dbGet(`SELECT COUNT(*) AS total FROM vdp WHERE deleted_at IS NULL`)
    return { total: row?.total || 0 }
  }),

  armesByType: wrap(async () =>
    dbAll(
      `SELECT COALESCE(c.type,'Inconnu') AS name,
              COUNT(a.id)                AS value
       FROM armes a
       LEFT JOIN config_arme c ON c.id = a.config_arme_id
       WHERE a.deleted_at IS NULL
       GROUP BY c.type
       ORDER BY value DESC, name`
    )
  ),

  armesByCategory: wrap(async () =>
    dbAll(
      `SELECT COALESCE(c.categorie,'Inconnu') AS name,
              COUNT(a.id)                      AS value
       FROM armes a
       LEFT JOIN config_arme c ON c.id = a.config_arme_id
       WHERE a.deleted_at IS NULL
       GROUP BY c.categorie
       ORDER BY value DESC, name`
    )
  ),

  armesByStatus: wrap(async () =>
    dbAll(
      `SELECT COALESCE(a.etat,'Inconnu') AS name,
              COUNT(*)                   AS value
       FROM armes a
       WHERE a.deleted_at IS NULL
       GROUP BY a.etat
       ORDER BY value DESC, name`
    )
  ),

  armesTimeSeries: wrap(async () =>
    dbAll(
      `SELECT DATE(date_entree) AS date,
              COUNT(*)          AS total
       FROM armes
       WHERE deleted_at IS NULL
         AND date_entree IS NOT NULL
       GROUP BY DATE(date_entree)
       ORDER BY DATE(date_entree)`
    )
  ),

  munitionsByType: wrap(async () =>
    dbAll(
      `SELECT COALESCE(cm.designation,'Inconnu') AS name,
              SUM(COALESCE(m.balance,0))         AS value
       FROM munitions m
       LEFT JOIN config_munition cm ON cm.id = m.config_munition_id
       WHERE m.deleted_at IS NULL
       GROUP BY cm.designation
       ORDER BY value DESC, name`
    )
  ),

  munitionsTimeSeries: wrap(async () =>
    dbAll(
      `SELECT DATE(date_operation) AS date,
              SUM(CASE WHEN type_operation='ENTREE' THEN quantite ELSE -quantite END) AS total
       FROM transactions_munitions
       WHERE deleted_at IS NULL
         AND date_operation IS NOT NULL
       GROUP BY DATE(date_operation)
       ORDER BY DATE(date_operation)`
    )
  ),

  materielByType: wrap(async () =>
    dbAll(
      `SELECT COALESCE(cm.designation,'Inconnu') AS name,
              COUNT(ms.id)                       AS value
       FROM materiels_specifiques ms
       LEFT JOIN config_materiel cm ON cm.id = ms.config_materiel_id
       WHERE ms.deleted_at IS NULL
       GROUP BY cm.designation
       ORDER BY value DESC, name`
    )
  ),

  materielTimeSeries: wrap(async () =>
    dbAll(
      `SELECT DATE(date_entree) AS date,
              COUNT(*)          AS total
       FROM materiels_specifiques
       WHERE deleted_at IS NULL
         AND date_entree IS NOT NULL
       GROUP BY DATE(date_entree)
       ORDER BY DATE(date_entree)`
    )
  ),

  dotationsByResource: wrap(async () =>
    dbAll(
      `SELECT COALESCE(ressource_type,'Inconnu') AS name,
              COUNT(*)                           AS value
       FROM dotations
       WHERE deleted_at IS NULL
       GROUP BY ressource_type
       ORDER BY value DESC, name`
    )
  ),

  dotationsTimeSeries: wrap(async () =>
    dbAll(
      `SELECT DATE(date_dotation) AS date,
              COUNT(*)            AS total
       FROM dotations
       WHERE deleted_at IS NULL
         AND date_dotation IS NOT NULL
       GROUP BY DATE(date_dotation)
       ORDER BY DATE(date_dotation)`
    )
  ),

  vdpByGender: wrap(async () =>
    dbAll(
      `SELECT COALESCE(sexe,'Inconnu') AS name,
              COUNT(*)                 AS value
       FROM vdp
       WHERE deleted_at IS NULL
       GROUP BY sexe
       ORDER BY value DESC, name`
    )
  ),

  vdpByAgeGroup: wrap(async () =>
    dbAll(
      `SELECT CASE
               WHEN date_naissance IS NULL THEN 'Inconnu'
               WHEN (julianday('now') - julianday(date_naissance)) / 365.25 < 18 THEN '0-17'
               WHEN (julianday('now') - julianday(date_naissance)) / 365.25 BETWEEN 18 AND 30 THEN '18-30'
               WHEN (julianday('now') - julianday(date_naissance)) / 365.25 BETWEEN 31 AND 50 THEN '31-50'
               ELSE '51+' END AS name,
              COUNT(*) AS value
       FROM vdp
       WHERE deleted_at IS NULL
       GROUP BY name
       ORDER BY value DESC, name`
    )
  ),

  vdpByEntity: wrap(async () =>
    dbAll(
      `SELECT COALESCE(e.nom,'Inconnu') AS name,
              COUNT(v.id)               AS value
       FROM vdp v
       LEFT JOIN entites e ON e.id = v.entite_id
       WHERE v.deleted_at IS NULL
       GROUP BY e.nom
       ORDER BY value DESC, name`
    )
  ),
}
