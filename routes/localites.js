const express = require('express');
const router = express.Router();

module.exports = (db) => {
  if (!db || typeof db.all !== 'function') {
    console.error('[routes/localites] Instance db invalide');
    return router;
  }

  const listColumns = async (tableName) => {
    if (typeof db.listTableColumns === 'function') {
      return db.listTableColumns(tableName);
    }
    const rows = await db.all(
      "SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name = ? ORDER BY ordinal_position",
      [tableName]
    );
    return (rows || []).map(r => r?.name).filter(Boolean);
  };

  // GET /api/localites (liste enrichie)
  router.get('/', async (req, res) => {
    const includeDeleted = req.query?.includeDeleted === 'true';
    const where = includeDeleted ? '' : ' WHERE l.deleted_at IS NULL';
    const query = `
      SELECT
        l.*,
        r.nom AS region_nom,
        p.nom AS province_nom,
        c.nom AS commune_nom
      FROM localites l
      LEFT JOIN regions r ON r.id = l.region_id
      LEFT JOIN provinces p ON p.id = l.province_id
      LEFT JOIN communes c ON c.id = l.commune_id
      ${where}
      ORDER BY l.nom
    `;
    console.log('[routes/localites] GET / - SQL:', query);
    try {
      const rows = await db.all(query, []);
      console.log(`[routes/localites] GET / - Retour ${(rows || []).length} lignes`);
      res.json(rows || []);
    } catch (err) {
      console.error('[routes/localites] Erreur SELECT:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
  });

  // GET /api/localites/:id (détail enrichi)
  router.get('/:id', async (req, res) => {
    const includeDeleted = req.query?.includeDeleted === 'true';
    const baseQuery = `
      SELECT
        l.*,
        r.nom AS region_nom,
        p.nom AS province_nom,
        c.nom AS commune_nom
      FROM localites l
      LEFT JOIN regions r ON r.id = l.region_id
      LEFT JOIN provinces p ON p.id = l.province_id
      LEFT JOIN communes c ON c.id = l.commune_id
      WHERE l.id = ?
    `;
    const query = includeDeleted ? baseQuery : `${baseQuery} AND l.deleted_at IS NULL`;
    try {
      const row = await db.get(query, [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Introuvable' });
      res.json(row);
    } catch (err) {
      console.error('[routes/localites] Erreur SELECT by ID:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
  });

  // POST /api/localites (création)
  router.post('/', express.json(), async (req, res) => {
    const payload = req.body || {};
    console.log('[routes/localites] POST / - body:', payload);

    try {
      const validCols = await listColumns('localites');
      const filtered = Object.fromEntries(
        Object.entries(payload).filter(([k]) => validCols.includes(k))
      );
      const cols = Object.keys(filtered);
      if (!cols.length) {
        return res.status(400).json({ error: 'Aucune donnée fournie' });
      }

      const placeholders = cols.map(() => '?').join(',');
      const insertQuery = `INSERT INTO localites (${cols.join(',')}) VALUES (${placeholders})`;
      const result = await db.run(insertQuery, Object.values(filtered));
      const insertedId = result?.lastID;
      if (!insertedId) {
        return res.status(500).json({ error: 'Création échouée (id non retourné)' });
      }

      const fetchQuery = `
        SELECT
          l.*,
          r.nom AS region_nom,
          p.nom AS province_nom,
          c.nom AS commune_nom
        FROM localites l
        LEFT JOIN regions r ON r.id = l.region_id
        LEFT JOIN provinces p ON p.id = l.province_id
        LEFT JOIN communes c ON c.id = l.commune_id
        WHERE l.id = ?
      `;
      const row = await db.get(fetchQuery, [insertedId]);
      if (!row) {
        return res.status(500).json({ error: 'Enregistrement introuvable après création' });
      }
      res.status(201).json(row);
    } catch (err) {
      console.error('[routes/localites] Erreur INSERT:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
  });

  // PUT /api/localites/:id (mise à jour)
  router.put('/:id', express.json(), async (req, res) => {
    const id = req.params.id;
    const payload = req.body || {};
    console.log('[routes/localites] PUT /:id - body:', payload);

    try {
      const validCols = await listColumns('localites');
      const filtered = Object.fromEntries(
        Object.entries(payload).filter(([k]) => validCols.includes(k))
      );
      const keys = Object.keys(filtered);
      if (!keys.length) {
        return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
      }

      const assignments = keys.map(key => `${key} = ?`);
      if (validCols.includes('updated_at') && !keys.includes('updated_at')) {
        assignments.push('updated_at = CURRENT_TIMESTAMP');
      }

      const updateQuery = `UPDATE localites SET ${assignments.join(', ')} WHERE id = ?`;
      const values = [...keys.map(key => filtered[key]), id];
      await db.run(updateQuery, values);

      const fetchQuery = `
        SELECT
          l.*,
          r.nom AS region_nom,
          p.nom AS province_nom,
          c.nom AS commune_nom
        FROM localites l
        LEFT JOIN regions r ON r.id = l.region_id
        LEFT JOIN provinces p ON p.id = l.province_id
        LEFT JOIN communes c ON c.id = l.commune_id
        WHERE l.id = ?
      `;
      const row = await db.get(fetchQuery, [id]);
      if (!row) return res.status(404).json({ error: 'Introuvable' });
      res.json(row);
    } catch (err) {
      console.error('[routes/localites] Erreur UPDATE:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
  });

  // DELETE /api/localites/:id (suppression)
  router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    const wantsHardDelete = req.query?.hard === 'true';

    try {
      if (wantsHardDelete) {
        await db.run('DELETE FROM localites WHERE id = ?', [id]);
        return res.json({ ok: true, id: Number(id), hard: true });
      }
      await db.run('UPDATE localites SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      return res.json({ ok: true, id: Number(id) });
    } catch (err) {
      console.error('[routes/localites] Erreur DELETE:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
  });

  return router;
};
