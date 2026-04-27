const express = require('express')
const router = express.Router()
const { db } = require('../database/database')

// Liste des munitions
router.get('/', (req, res) => {
  db.all(`SELECT * FROM munitions WHERE deleted_at IS NULL ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows || [])
  })
})

// Détail d'une munition
router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM munitions WHERE id = ? AND deleted_at IS NULL`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!row) return res.status(404).json({ error: 'Introuvable' })
    res.json(row)
  })
})

// Ajout
router.post('/', (req, res) => {
  const fields = Object.keys(req.body)
  const values = Object.values(req.body)
  db.run(
    `INSERT INTO munitions (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
    values,
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get(`SELECT * FROM munitions WHERE id = ?`, [this.lastID], (e, row) => {
        if (e) return res.status(500).json({ error: e.message })
        res.status(201).json(row)
      })
    }
  )
})

// Modification
router.put('/:id', (req, res) => {
  const fields = Object.keys(req.body).filter(k => k !== 'id')
  const values = fields.map(k => req.body[k])
  db.run(
    `UPDATE munitions SET ${fields.map(f => `${f} = ?`).join(',')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get(`SELECT * FROM munitions WHERE id = ?`, [req.params.id], (e, row) => {
        if (e) return res.status(500).json({ error: e.message })
        res.json(row)
      })
    }
  )
})

// Suppression (soft delete)
router.delete('/:id', (req, res) => {
  db.run(`UPDATE munitions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// Historique des mouvements
router.get('/:id/mouvements', (req, res) => {
  db.all(`SELECT * FROM mouvements_munitions WHERE munition_id = ? ORDER BY date_mouvement DESC`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows || [])
  })
})

// Alertes
router.get('/:id/alertes', (req, res) => {
  db.all(`SELECT * FROM alertes_munitions WHERE munition_id = ? ORDER BY date_alerte DESC`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows || [])
  })
})

module.exports = router
