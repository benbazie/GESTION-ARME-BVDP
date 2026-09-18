// routes/dotations.js
'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/dotationController');
const { hasScope } = require('../utils/scope');

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

const parseIntParam = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const parseBool = (v) => {
  if (v === true || v === false) return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
};

/**
 * Extrait les filtres standards depuis req.query.
 * Accepte : statut, beneficiary_type, dotation_type, vdp_id, entite_id,
 *           coordination_id, resource_type, q (recherche plein texte).
 */
const parseFilters = (query = {}) => ({
  statut:           query.statut           || null,
  beneficiary_type: query.beneficiary_type || null,
  dotation_type:    query.dotation_type    || null,
  vdp_id:           query.vdp_id    ? Number(query.vdp_id)    : null,
  entite_id:        query.entite_id ? Number(query.entite_id) : null,
  coordination_id:  query.coordination_id ? Number(query.coordination_id) : null,
  resource_type:    query.resource_type    || null,
});

const parseListOpts = (query = {}) => ({
  limit:   parseIntParam(query.limit,  200),
  offset:  parseIntParam(query.offset, 0),
  sortBy:  query.sortBy  || 'date_dotation',
  sortDir: query.sortDir || 'desc',
  search:  query.q ? { q: query.q } : null,
});

/** Renvoie le scope organisationnel attaché par authMiddleware. */
const getScope = (req) => (hasScope(req.scope) ? req.scope : {});

/** Vérifie que la dotation appartient au scope de l'utilisateur. */
const db = require('../database/database');

const inScope = async (dotationId, scope) => {
  if (!hasScope(scope)) return true;
  const filters = [];
  const params  = [dotationId];
  if (scope.entite_id != null) {
    filters.push('(d.entite_id = ? OR v.entite_id = ?)');
    params.push(scope.entite_id, scope.entite_id);
  }
  if (scope.sous_entite_id != null) {
    filters.push('(d.sous_entite_id = ? OR v.sous_entite_id = ?)');
    params.push(scope.sous_entite_id, scope.sous_entite_id);
  }
  if (!filters.length) return true;
  const row = await db.get(
    `SELECT d.id FROM dotations d LEFT JOIN vdp v ON v.id = d.vdp_id
     WHERE d.id = ? AND ${filters.join(' AND ')} LIMIT 1`,
    params
  );
  return !!row;
};

/** Applique le scope au payload (force entite_id / sous_entite_id). */
const applyScope = (payload, scope) => {
  if (!hasScope(scope)) return payload;
  if (scope.entite_id    != null) payload.entite_id    = scope.entite_id;
  if (scope.sous_entite_id != null) payload.sous_entite_id = scope.sous_entite_id;
  return payload;
};

/** Wrap try/catch pour les handlers async. */
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    const body   = { error: err.message || 'INTERNAL_ERROR' };
    if (err.conflicts) body.conflicts = err.conflicts;
    res.status(status).json(body);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /  — liste paginée avec filtres ────────────────────────────────────────
router.get('/', wrap(async (req, res) => {
  const result = await controller.list({
    listOpts: parseListOpts(req.query),
    filters:  parseFilters(req.query),
    scope:    getScope(req),
    includeDeleted: parseBool(req.query.includeDeleted),
  });
  res.json(result);
}));

// ── GET /with-details  — alias avec items embarqués (compat) ──────────────────
router.get('/with-details', wrap(async (req, res) => {
  const result = await controller.list({
    listOpts: parseListOpts(req.query),
    filters:  parseFilters(req.query),
    scope:    getScope(req),
  });
  // Embarquer les items pour chaque ligne
  const rows = await Promise.all(
    (result.rows || []).map(async (row) => {
      const full = await controller.get({ id: row.id });
      return full || row;
    })
  );
  res.json({ rows, total: result.total });
}));

// ── GET /beneficiary/vdp/:vdpId ───────────────────────────────────────────────
router.get('/beneficiary/vdp/:vdpId', wrap(async (req, res) => {
  const vdpId = parseIntParam(req.params.vdpId, null);
  if (!vdpId) return res.status(400).json({ error: 'INVALID_VDP_ID' });

  const result = await controller.list({
    listOpts: parseListOpts(req.query),
    filters:  { ...parseFilters(req.query), vdp_id: vdpId },
    scope:    getScope(req),
  });
  res.json(result);
}));

// ── GET /beneficiary/entite/:entiteId ─────────────────────────────────────────
router.get('/beneficiary/entite/:entiteId', wrap(async (req, res) => {
  const entiteId = parseIntParam(req.params.entiteId, null);
  if (!entiteId) return res.status(400).json({ error: 'INVALID_ENTITE_ID' });

  const result = await controller.list({
    listOpts: parseListOpts(req.query),
    filters:  { ...parseFilters(req.query), entite_id: entiteId },
    scope:    getScope(req),
  });
  res.json(result);
}));

// ── GET /:id  — détail complet avec items ─────────────────────────────────────
router.get('/:id', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const dotation = await controller.get({ id });
  if (!dotation) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(dotation);
}));

// ── POST /  — créer une dotation (multi-items supporté) ───────────────────────
router.post('/', wrap(async (req, res) => {
  const payload = applyScope({ ...(req.body || {}) }, getScope(req));

  const dotation = await controller.add({
    body:        payload,
    currentUser: req.user || null,
  });
  res.status(201).json(dotation);
}));

// ── PUT /:id  — remplacer une dotation ────────────────────────────────────────
router.put('/:id', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const payload = applyScope({ ...(req.body || {}) }, getScope(req));
  const updated = await controller.update({
    id,
    body:        payload,
    currentUser: req.user || null,
  });
  if (!updated) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(updated);
}));

// ── POST /:id/items  — ajouter/remplacer les items d'une dotation ─────────────
router.post('/:id/items', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const updated = await controller.update({
    id,
    body:        { items },
    currentUser: req.user || null,
  });
  if (!updated) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(updated);
}));

// ── PATCH /:id/statut  — changer le statut ────────────────────────────────────
router.patch('/:id/statut', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const statut = (req.body?.statut || req.body?.status || '').toString().trim();
  if (!statut) return res.status(400).json({ error: 'STATUT_REQUIRED' });

  const updated = await controller.changerStatut({ id, statut, currentUser: req.user || null });
  if (!updated) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(updated);
}));

// ── PATCH /:id/items/:itemId/status  — changer le statut d'un item (compat) ───
router.patch('/:id/items/:itemId/status', wrap(async (req, res) => {
  const dotationId = parseIntParam(req.params.id, null);
  const itemId     = parseIntParam(req.params.itemId, null);
  if (!dotationId || !itemId) return res.status(400).json({ error: 'INVALID_IDS' });

  if (!await inScope(dotationId, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const nextStatus = (req.body?.status || req.body?.statut || '').toString().trim();
  if (!nextStatus) return res.status(400).json({ error: 'INVALID_STATUS' });

  const result = await db.run(
    `UPDATE dotation_items SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND dotation_id = ? AND deleted_at IS NULL`,
    [nextStatus, itemId, dotationId]
  );
  if (!result?.changes) return res.status(404).json({ error: 'DOTATION_ITEM_NOT_FOUND' });

  const updated = await controller.get({ id: dotationId });
  res.json(updated);
}));

// ── POST /:id/retour  — retour de la dotation (workflow complet) ──────────────
router.post('/:id/retour', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const updated = await controller.retour({
    id,
    body:        req.body || {},
    currentUser: req.user || null,
  });
  if (!updated) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(updated);
}));

// ── POST /:id/transferer  — transfert vers un nouveau bénéficiaire ─────────────
router.post('/:id/transferer', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const updated = await controller.transferer({
    id,
    body:        req.body || {},
    currentUser: req.user || null,
  });
  if (!updated) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json(updated);
}));

// ── DELETE /:id  — suppression (soft par défaut) ─────────────────────────────
router.delete('/:id', wrap(async (req, res) => {
  const id = parseIntParam(req.params.id, null);
  if (!id) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  if (!await inScope(id, getScope(req))) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const hard = parseBool(req.query.hard);
  const ok   = await controller.del({
    id,
    soft:        !hard,
    currentUser: req.user || null,
  });
  if (!ok) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
  res.json({ ok: true, hard });
}));

module.exports = router;
