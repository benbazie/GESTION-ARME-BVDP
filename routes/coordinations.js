const express = require('express');
const router = express.Router();
const controller = require('../controllers/coordinationController');

// Liste générique (compat UI): GET /api/coordinations
// Par défaut retourne les coordinations communales.
// Optionnel: ?level=regionale|provinciale|communale et ?parent_id=<id>
router.get('/', async (req, res) => {
  try {
    const levelRaw = (req.query.level || req.query.niveau || '').toString().trim().toLowerCase();
    const parentIdRaw = req.query.parent_id ?? req.query.parentId ?? null;
    const parentId = parentIdRaw != null && String(parentIdRaw).trim() !== '' ? Number(parentIdRaw) : null;

    if (levelRaw === 'regionale') {
      return res.json(await controller.listRegionale());
    }

    if (levelRaw === 'provinciale') {
      if (parentId != null && !Number.isNaN(parentId)) {
        return res.json(await controller.listProvinciale(parentId));
      }
      // liste complète des provinciales
      const { db } = require('../database/database');
      return db.all(
        'SELECT cp.*, p.nom AS province_nom FROM coordination_provinciale cp LEFT JOIN provinces p ON cp.province_id = p.id',
        [],
        (err, rows) => (err ? res.status(500).json({ error: err.message }) : res.json(rows || []))
      );
    }

    if (levelRaw === 'communale') {
      if (parentId != null && !Number.isNaN(parentId)) {
        return res.json(await controller.listCommunale(parentId));
      }
      // liste complète des communales
      const { db } = require('../database/database');
      return db.all(
        'SELECT cc.*, c.nom AS commune_nom FROM coordination_communale cc LEFT JOIN communes c ON cc.commune_id = c.id',
        [],
        (err, rows) => (err ? res.status(500).json({ error: err.message }) : res.json(rows || []))
      );
    }

    // défaut: communales (compat VdpList / formulaires)
    const { db } = require('../database/database');
    return db.all(
      'SELECT cc.*, c.nom AS commune_nom FROM coordination_communale cc LEFT JOIN communes c ON cc.commune_id = c.id',
      [],
      (err, rows) => (err ? res.status(500).json({ error: err.message }) : res.json(rows || []))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Régionaux
router.get('/regionale', async (req, res) => {
  try { res.json(await controller.listRegionale()) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.post('/regionale', async (req, res) => {
  try { res.json(await controller.createRegionale(req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.get('/regionale/:id', async (req, res) => {
  try { res.json(await controller.getRegionale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.put('/regionale/:id', async (req, res) => {
  try { res.json(await controller.updateRegionale(req.params.id, req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.delete('/regionale/:id', async (req, res) => {
  try { res.json(await controller.deleteRegionale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});

// Provinciales
router.get('/provinciale/:regionale_id', async (req, res) => {
  try { res.json(await controller.listProvinciale(req.params.regionale_id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.post('/provinciale', async (req, res) => {
  try { res.json(await controller.createProvinciale(req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.get('/provinciale/id/:id', async (req, res) => {
  try { res.json(await controller.getProvinciale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.put('/provinciale/:id', async (req, res) => {
  try { res.json(await controller.updateProvinciale(req.params.id, req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.delete('/provinciale/:id', async (req, res) => {
  try { res.json(await controller.deleteProvinciale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});

// Communales
router.get('/communale/:provinciale_id', async (req, res) => {
  try { res.json(await controller.listCommunale(req.params.provinciale_id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.post('/communale', async (req, res) => {
  try { res.json(await controller.createCommunale(req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.get('/communale/id/:id', async (req, res) => {
  try { res.json(await controller.getCommunale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.put('/communale/:id', async (req, res) => {
  try { res.json(await controller.updateCommunale(req.params.id, req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.delete('/communale/:id', async (req, res) => {
  try { res.json(await controller.deleteCommunale(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});

// Localités liées à une coordination communale
router.get('/localites/:coordination_commune_id', async (req, res) => {
  try { res.json(await controller.listLocalites(req.params.coordination_commune_id)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.post('/localites', async (req, res) => {
  try { res.json(await controller.addLocalite(req.body)) } catch (e) { res.status(500).json({ error: e.message }) }
});
router.delete('/localites/:id', async (req, res) => {
  try { res.json(await controller.removeLocalite(req.params.id)) } catch (e) { res.status(500).json({ error: e.message }) }
});

module.exports = router;
