const express = require('express');
const router = express.Router();
const dbModule = require('../database/database');

const db = dbModule.db || dbModule;

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const mapRow = (row = {}) => ({
  id: row.id,
  code: row.code ?? null,
  designation: row.nom ?? row.designation ?? null,
  nom: row.nom ?? row.designation ?? null,
  description: row.description ?? null,
  provenance: row.provenance ?? null,
  source_id: row.source_dotation_id ?? row.source_id ?? null,
  source_dotation_id: row.source_dotation_id ?? row.source_id ?? null,
  periode_debut: row.date_reception ?? row.periode_debut ?? null,
  periode_fin: row.date_cloture ?? row.periode_fin ?? null,
  date_reception: row.date_reception ?? null,
  date_cloture: row.date_cloture ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  deleted_at: row.deleted_at ?? null,
});

router.get('/', async (req, res) => {
  try {
    const includeDeleted = String(req.query?.includeDeleted || '').toLowerCase() === 'true';
    const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    const rows = await all(
      `
        SELECT *
        FROM sources_armes
        ${where}
        ORDER BY COALESCE(updated_at, created_at, datetime('now')) DESC
      `
    );
    res.json(rows.map(mapRow));
  } catch (error) {
    console.error('[lots] list error:', error.message);
    res.status(500).json({ error: 'Erreur BD', detail: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await get('SELECT * FROM sources_armes WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Lot introuvable' });
    res.json(mapRow(row));
  } catch (error) {
    console.error('[lots] get error:', error.message);
    res.status(500).json({ error: 'Erreur BD', detail: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const designation = payload.designation || payload.nom;
    if (!designation) return res.status(400).json({ error: 'Le champ "designation" est requis.' });

    const params = [
      payload.code ?? null,
      designation,
      payload.description ?? null,
      payload.provenance ?? null,
      payload.source_id ?? payload.source_dotation_id ?? null,
      payload.periode_debut ?? payload.date_reception ?? null,
      payload.periode_fin ?? payload.date_cloture ?? null,
    ];

    const result = await run(
      `
        INSERT INTO sources_armes (
          code, nom, description, provenance, source_dotation_id,
          date_reception, date_cloture,
          created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
      `,
      params
    );

    const inserted = await get('SELECT * FROM sources_armes WHERE id = ?', [result.lastID]);
    res.status(201).json(mapRow(inserted));
  } catch (error) {
    console.error('[lots] create error:', error.message);
    res.status(500).json({ error: 'Erreur BD', detail: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const designation = payload.designation || payload.nom;
    if (!designation) return res.status(400).json({ error: 'Le champ "designation" est requis.' });

    const params = [
      payload.code ?? null,
      designation,
      payload.description ?? null,
      payload.provenance ?? null,
      payload.source_id ?? payload.source_dotation_id ?? null,
      payload.periode_debut ?? payload.date_reception ?? null,
      payload.periode_fin ?? payload.date_cloture ?? null,
      req.params.id,
    ];

    const result = await run(
      `
        UPDATE sources_armes
        SET
          code = ?,
          nom = ?,
          description = ?,
          provenance = ?,
          source_dotation_id = ?,
          date_reception = ?,
          date_cloture = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      params
    );

    if (!result.changes) return res.status(404).json({ error: 'Lot introuvable' });

    const updated = await get('SELECT * FROM sources_armes WHERE id = ?', [req.params.id]);
    res.json(mapRow(updated));
  } catch (error) {
    console.error('[lots] update error:', error.message);
    res.status(500).json({ error: 'Erreur BD', detail: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const hard = String(req.query?.hard || '').toLowerCase() === 'true';
    if (hard) {
      const result = await run('DELETE FROM sources_armes WHERE id = ?', [req.params.id]);
      if (!result.changes) return res.status(404).json({ error: 'Lot introuvable' });
      return res.json({ ok: true, id: Number(req.params.id), hard: true });
    }
    const result = await run(
      'UPDATE sources_armes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!result.changes) return res.status(404).json({ error: 'Lot introuvable' });
    res.json({ ok: true, id: Number(req.params.id) });
  } catch (error) {
    console.error('[lots] delete error:', error.message);
    res.status(500).json({ error: 'Erreur BD', detail: error.message });
  }
});

module.exports = router;
