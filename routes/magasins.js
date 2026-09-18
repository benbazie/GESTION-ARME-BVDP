'use strict';

/**
 * routes/magasins.js
 * Monté sur /api/magasins
 */

const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/magasinController');

// ─── CRUD magasins ────────────────────────────────────────────────────────────
// GET    /api/magasins              — liste (filtres: actif, entite_id, q, …)
// POST   /api/magasins              — créer
// GET    /api/magasins/:id          — détail
// PUT    /api/magasins/:id          — mettre à jour
// DELETE /api/magasins/:id          — soft delete

router.get   ('/',     ctrl.list);
router.post  ('/',     ctrl.create);
router.get   ('/:id',  ctrl.getById);
router.put   ('/:id',  ctrl.update);
router.delete('/:id',  ctrl.remove);

// ─── Stock ───────────────────────────────────────────────────────────────────
// GET    /api/magasins/:id/stock              — liste du stock courant
// POST   /api/magasins/:id/stock              — ajouter un article au stock
// DELETE /api/magasins/:id/stock              — retirer un article (perte…)
// GET    /api/magasins/:id/inventaire         — inventaire complet + résumé

router.get   ('/:id/stock',      ctrl.getStock);
router.post  ('/:id/stock',      ctrl.addToStock);
router.delete('/:id/stock',      ctrl.removeFromStock);
router.get   ('/:id/inventaire', ctrl.inventaire);

// ─── Mouvements ──────────────────────────────────────────────────────────────
// GET    /api/magasins/:id/mouvements         — journal (filtres: type, resource_type)

router.get('/:id/mouvements', ctrl.getMouvements);

// ─── Réintégration ───────────────────────────────────────────────────────────
// POST   /api/magasins/:id/reintegration      — VDP réintègre une arme dans CE magasin

router.post('/:id/reintegration', ctrl.reintegration);

module.exports = router;
