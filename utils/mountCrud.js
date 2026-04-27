// utils/mountCrud.js
'use strict'

const { Router } = require('express')

/**
 * Wrapper async pour éviter le boilerplate try/catch dans les handlers.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * Normalise un booléen depuis query string.
 */
const qBool = (val, def = false) => {
  if (val === undefined) return def
  if (typeof val === 'boolean') return val
  const s = String(val).toLowerCase()
  return ['1', 'true', 'yes', 'y', 'on'].includes(s)
}

/**
 * Convertit une string vers int sûr, sinon retourne null.
 */
const toIntOrNull = (v) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Options du mountCrud
 * @typedef {Object} MountCrudOptions
 * @property {import('express').Application} app - instance Express
 * @property {string} basePath - chemin de base, ex: '/api/armes'
 * @property {Object} ctrl - contrôleur: { list, get, add, update, patch?, del, bulkAdd?, bulkDel?, upsert? }
 * @property {Object} [perms] - permissions/roles par méthode (ex: { list:'armes:list' })
 * @property {Function} [roleMW] - middleware de rôle: (perm) => (req,res,next)
 * @property {Object} [validators] - { list?, get?, add?, update?, patch?, del?, bulkAdd?, bulkDel?, upsert? } => (ctx)=>void|throw
 * @property {Object} [hooks] - { list?:{before?,after?}, get?:..., add?:..., ... }
 * @property {Object} [features] - { pagination?, sorting?, search?, softDelete?, timestamps? }
 * @property {function} [select] - mappe/filtre le résultat avant réponse: (data, { many }) => any
 * @property {string} [idParam='id'] - nom du param id (ex: ':id')
 * @property {Object} [middlewares] - middlewares additionnels par méthode: { list:[fn], add:[fn], ... }
 */

/**
 * Monte des routes CRUD robustes et modulables.
 * Tolérant: ne monte une route que si la méthode correspondante existe dans le contrôleur.
 *
 * @param {MountCrudOptions} opts
 */
module.exports = function mountCrud(opts) {
  const {
    app,
    basePath,
    ctrl = {},
    perms = {},
    roleMW,
    validators = {},
    hooks = {},
    features = {},
    select,
    idParam = 'id',
    middlewares = {}
  } = opts

  if (!app || !basePath || !ctrl) {
    throw new Error('mountCrud: app, basePath et ctrl sont requis.')
  }

  const router = Router()

  // Config par défaut (surclassable via features)
  const cfg = {
    pagination: { enabled: true, limitMax: 100, defaultLimit: 20, ...(features.pagination || {}) },
    sorting: { enabled: true, ...(features.sorting || {}) },
    search: { enabled: true, fields: [], ...(features.search || {}) }, // fields: ['nom','code']
    softDelete: { enabled: false, column: 'deleted_at', ...(features.softDelete || {}) },
    timestamps: { enabled: false, createdAt: 'created_at', updatedAt: 'updated_at', ...(features.timestamps || {}) }
  }

  // Compose middlewares par méthode
  const chain = (method) => {
    const arr = []
    if (roleMW && perms[method]) arr.push(roleMW(perms[method]))
    if (Array.isArray(middlewares[method])) arr.push(...middlewares[method])
    return arr
  }

  // Exécute validator/hook si présent
  const run = async (fn, ctx) => { if (typeof fn === 'function') return fn(ctx) }

  // Mapping de sortie optionnel
  const mapOut = (data, many = false) => (typeof select === 'function' ? select(data, { many }) : data)

  // Construit les options de list depuis req.query
  const listOptionsFromQuery = (req) => {
    const page = toIntOrNull(req.query.page) || 1
    const limitRaw = toIntOrNull(req.query.limit)
    const limit = Math.min(
      Math.max(limitRaw || cfg.pagination.defaultLimit, 1),
      cfg.pagination.limitMax
    )
    const offset = (page - 1) * limit

    const sortBy = cfg.sorting.enabled ? (req.query.sortBy || null) : null
    const sortDir = cfg.sorting.enabled
      ? (String(req.query.sortDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc')
      : null

    let search = null
    if (cfg.search.enabled) {
      const q = (req.query.q || '').toString().trim()
      if (q) search = { q, fields: cfg.search.fields }
    }

    return { page, limit, offset, sortBy, sortDir, search }
  }

  // LIST
  if (typeof ctrl.list === 'function') {
    router.get(
      '/',
      ...chain('list'),
      asyncHandler(async (req, res) => {
        await run(validators.list, { req })
        await run(hooks.list?.before, { req })

        const listOpts = cfg.pagination.enabled ? listOptionsFromQuery(req) : {}
        const filters = { ...req.query }
        // Paramètres réservés
        delete filters.page
        delete filters.limit
        delete filters.sortBy
        delete filters.sortDir
        delete filters.q

        const payload = await ctrl.list({ req, listOpts, filters, softDelete: cfg.softDelete })
        // payload attendu: { rows, total } ou Array
        let rows = payload?.rows ?? payload
        let total = payload?.total ?? (Array.isArray(rows) ? rows.length : undefined)

        rows = Array.isArray(rows) ? rows : []
        const out = mapOut(rows, true)

        await run(hooks.list?.after, { req, res, rows: out, total })
        if (cfg.pagination.enabled) {
          res.json({ data: out, total, page: listOpts.page, limit: listOpts.limit })
        } else {
          res.json(out)
        }
      })
    )
  }

  // GET
  if (typeof ctrl.get === 'function') {
    router.get(
      `/:${idParam}`,
      ...chain('get'),
      asyncHandler(async (req, res) => {
        await run(validators.get, { req })
        await run(hooks.get?.before, { req })

        const id = req.params[idParam]
        const row = await ctrl.get({ req, id, softDelete: cfg.softDelete })
        if (!row) return res.status(404).json({ error: 'Not found' })

        const out = mapOut(row, false)
        await run(hooks.get?.after, { req, res, row: out })
        res.json(out)
      })
    )
  }

  // ADD (POST)
  if (typeof ctrl.add === 'function') {
    router.post(
      '/',
      ...chain('add'),
      asyncHandler(async (req, res) => {
        await run(validators.add, { req })
        await run(hooks.add?.before, { req })

        const body = { ...req.body }
        // timestamps
        if (cfg.timestamps.enabled && cfg.timestamps.createdAt) {
          body[cfg.timestamps.createdAt] = new Date().toISOString()
        }
        if (cfg.timestamps.enabled && cfg.timestamps.updatedAt) {
          body[cfg.timestamps.updatedAt] = new Date().toISOString()
        }

        const created = await ctrl.add({ req, body })
        const out = mapOut(created, false)

        await run(hooks.add?.after, { req, res, row: out })
        res.status(201).json(out)
      })
    )
  }

  // UPSERT (PUT /)
  if (typeof ctrl.upsert === 'function') {
    router.put(
      '/',
      ...chain('upsert'),
      asyncHandler(async (req, res) => {
        await run(validators.upsert, { req })
        await run(hooks.upsert?.before, { req })

        const body = { ...req.body }
        if (cfg.timestamps.enabled && cfg.timestamps.updatedAt) {
          body[cfg.timestamps.updatedAt] = new Date().toISOString()
        }

        const saved = await ctrl.upsert({ req, body })
        const out = mapOut(saved, false)

        await run(hooks.upsert?.after, { req, res, row: out })
        res.status(200).json(out)
      })
    )
  }

  // UPDATE (PUT :id)
  if (typeof ctrl.update === 'function') {
    router.put(
      `/:${idParam}`,
      ...chain('update'),
      asyncHandler(async (req, res) => {
        await run(validators.update, { req })
        await run(hooks.update?.before, { req })

        const id = req.params[idParam]
        const body = { ...req.body }
        if (cfg.timestamps.enabled && cfg.timestamps.updatedAt) {
          body[cfg.timestamps.updatedAt] = new Date().toISOString()
        }

        const updated = await ctrl.update({ req, id, body })
        if (!updated) return res.status(404).json({ error: 'Not found' })

        const out = mapOut(updated, false)
        await run(hooks.update?.after, { req, res, row: out })
        res.json(out)
      })
    )
  }

  // PATCH (partiel)
  if (typeof ctrl.patch === 'function') {
    router.patch(
      `/:${idParam}`,
      ...chain('patch'),
      asyncHandler(async (req, res) => {
        await run(validators.patch, { req })
        await run(hooks.patch?.before, { req })

        const id = req.params[idParam]
        const body = { ...req.body }
        if (cfg.timestamps.enabled && cfg.timestamps.updatedAt) {
          body[cfg.timestamps.updatedAt] = new Date().toISOString()
        }

        const updated = await ctrl.patch({ req, id, body })
        if (!updated) return res.status(404).json({ error: 'Not found' })

        const out = mapOut(updated, false)
        await run(hooks.patch?.after, { req, res, row: out })
        res.json(out)
      })
    )
  }

  // DELETE (soft/hard)
  if (typeof ctrl.del === 'function') {
    router.delete(
      `/:${idParam}`,
      ...chain('del'),
      asyncHandler(async (req, res) => {
        await run(validators.del, { req })
        await run(hooks.del?.before, { req })

        const id = req.params[idParam]
        const soft = cfg.softDelete.enabled && !qBool(req.query.hard, false)

        const result = await ctrl.del({ req, id, soft, softColumn: cfg.softDelete.column })
        // result: boolean | { affected } | object
        if (!result) return res.status(404).json({ error: 'Not found' })

        await run(hooks.del?.after, { req, res, result })

        // 204 si aucune data à renvoyer
        if (result === true || result?.affected === 1) return res.status(204).end()
        res.json(mapOut(result, false))
      })
    )
  }

  // BULK ADD (POST /bulk)
  if (typeof ctrl.bulkAdd === 'function') {
    router.post(
      '/bulk',
      ...chain('bulkAdd'),
      asyncHandler(async (req, res) => {
        await run(validators.bulkAdd, { req })
        await run(hooks.bulkAdd?.before, { req })

        const items = Array.isArray(req.body) ? req.body : (req.body?.items || [])
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Liste vide' })
        }

        const rows = await ctrl.bulkAdd({ req, items })
        await run(hooks.bulkAdd?.after, { req, res, rows })
        res.status(201).json(mapOut(rows, true))
      })
    )
  }

  // BULK DELETE (DELETE /bulk)
  if (typeof ctrl.bulkDel === 'function') {
    router.delete(
      '/bulk',
      ...chain('bulkDel'),
      asyncHandler(async (req, res) => {
        await run(validators.bulkDel, { req })
        await run(hooks.bulkDel?.before, { req })

        const ids = Array.isArray(req.body) ? req.body : (req.body?.ids || [])
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: 'Liste vide' })
        }

        const soft = cfg.softDelete.enabled && !qBool(req.query.hard, false)
        const result = await ctrl.bulkDel({ req, ids, soft, softColumn: cfg.softDelete.column })

        await run(hooks.bulkDel?.after, { req, res, result })
        res.json({ ok: true, ...result })
      })
    )
  }

  app.use(basePath, router)
}
