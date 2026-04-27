// routes/dashboard.js
'use strict'

const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/dashboardController')

// Totaux
router.get('/armes',             ctrl.totalArmes)
router.get('/munitions/summary', ctrl.summaryMunitions)
router.get('/materiel/summary',  ctrl.summaryMateriel)
router.get('/dotations',         ctrl.totalDotations)
router.get('/vdp',               ctrl.totalVdp)

// Breakdown ARMES
router.get('/armes/by-type',     ctrl.armesByType)
router.get('/armes/by-category', ctrl.armesByCategory)
router.get('/armes/by-status',   ctrl.armesByStatus)
router.get('/armes/timeseries',  ctrl.armesTimeSeries)

// Breakdown MUNITIONS
router.get('/munitions/by-type',    ctrl.munitionsByType)
router.get('/munitions/timeseries', ctrl.munitionsTimeSeries)

// Breakdown MATERIEL
router.get('/materiel/by-type',     ctrl.materielByType)
router.get('/materiel/timeseries',  ctrl.materielTimeSeries)

// Breakdown DOTATIONS
router.get('/dotations/by-resource', ctrl.dotationsByResource)
router.get('/dotations/timeseries',  ctrl.dotationsTimeSeries)

// Breakdown VDP
router.get('/vdp/by-gender',     ctrl.vdpByGender)
router.get('/vdp/by-age-group',  ctrl.vdpByAgeGroup)
router.get('/vdp/by-entity',     ctrl.vdpByEntity)

module.exports = router
