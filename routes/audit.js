const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

// Tableau de bord d'activité
router.get('/dashboard', auditController.getDashboard);

// Historique d'une table
router.get('/table/:table', auditController.getTableAudit);

// Historique d'un enregistrement spécifique
router.get('/record/:table/:id', auditController.getRecordHistory);

// Détails enrichis d'une arme
router.get('/arme/:id/detail', auditController.getArmeDetail);

module.exports = router;
