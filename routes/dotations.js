const express = require('express');
const router = express.Router();
const db = require('../database/database');
const { hasScope } = require('../utils/scope');

// ...helpers...
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DOTATION_SCOPE_COLUMNS = ['entite_id', 'sous_entite_id'];

const applyScopeToDotationPayload = (payload = {}, scope = {}, { forceAssign = true } = {}) => {
  if (!payload || !hasScope(scope)) return payload;
  DOTATION_SCOPE_COLUMNS.forEach((column) => {
    if (scope[column] === undefined || scope[column] === null) return;
    if (!forceAssign && !Object.prototype.hasOwnProperty.call(payload, column)) return;
    payload[column] = scope[column];
  });
  return payload;
};

const buildDotationScopeClause = (scope = {}) => {
  // NOTE: utilise des alias SQL (d/v) car certaines dotations scoperont via le bénéficiaire VDP.
  if (!hasScope(scope)) return { clause: '', params: [] };
  const filters = [];
  const params = [];

  const entiteId = scope.entite_id;
  if (entiteId !== undefined && entiteId !== null) {
    filters.push('(d.entite_id = ? OR v.entite_id = ?)');
    params.push(entiteId, entiteId);
  }

  const sousEntiteId = scope.sous_entite_id;
  if (sousEntiteId !== undefined && sousEntiteId !== null) {
    filters.push('(d.sous_entite_id = ? OR v.sous_entite_id = ?)');
    params.push(sousEntiteId, sousEntiteId);
  }

  return { clause: filters.join(' AND '), params };
};

const ensureDotationInScope = async (dotationId, scope = {}) => {
  const { clause, params } = buildDotationScopeClause(scope);
  if (!clause) return true;
  const row = await get(
    `
      SELECT d.id
      FROM dotations d
      LEFT JOIN vdp v ON v.id = d.vdp_id
      WHERE d.id = ? AND ${clause}
      LIMIT 1
    `,
    [dotationId, ...params]
  );
  return !!row;
};

const normalizeDate = (input) => {
  if (!input) return null;
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
};

const getDotationWithItems = async (id) => {
  const dotation = await get('SELECT * FROM dotations WHERE id = ?', [id]);
  if (!dotation) return null;
  dotation.items = await all('SELECT * FROM dotation_items WHERE dotation_id = ?', [id]);
  return dotation;
};

const parseBool = (value) => {
  if (value === true || value === false) return value;
  if (value === undefined || value === null) return false;
  const raw = String(value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
};

const parseIntParam = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fetchItemsForDotations = async (dotationRows = []) => {
  const ids = (dotationRows || []).map((row) => row?.id).filter((id) => Number.isFinite(Number(id)));
  if (!ids.length) return new Map();

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await all(
    `SELECT * FROM dotation_items WHERE dotation_id IN (${placeholders}) ORDER BY dotation_id ASC, id ASC`,
    ids
  );
  const grouped = new Map();
  for (const item of rows || []) {
    const dotationId = item?.dotation_id;
    if (!grouped.has(dotationId)) grouped.set(dotationId, []);
    grouped.get(dotationId).push(item);
  }
  return grouped;
};

const listDotations = async ({ whereSql = '', whereParams = [], scope = {}, includeDeleted = false, limit = 500, offset = 0 } = {}) => {
  const scopeClause = buildDotationScopeClause(scope);
  const filters = [];
  const params = [];

  if (whereSql) {
    filters.push(`(${whereSql})`);
    params.push(...(whereParams || []));
  }

  if (!includeDeleted) {
    filters.push('d.deleted_at IS NULL');
  }

  if (scopeClause?.clause) {
    filters.push(scopeClause.clause);
    params.push(...scopeClause.params);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const dotations = await all(
    `
      SELECT d.*
      FROM dotations d
      LEFT JOIN vdp v ON v.id = d.vdp_id
      ${where}
      ORDER BY d.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, safeOffset]
  );

  const itemsByDotation = await fetchItemsForDotations(dotations);
  return (dotations || []).map((dotation) => {
    const items = itemsByDotation.get(dotation.id) || [];
    return {
      ...dotation,
      items,
      items_count: dotation.items_count ?? items.length,
    };
  });
};

// --- READ endpoints (manquants) ---

router.get('/with-details', async (req, res) => {
  try {
    const includeDeleted = parseBool(req.query?.includeDeleted);
    const limit = parseIntParam(req.query?.limit, 500);
    const offset = parseIntParam(req.query?.offset, 0);
    const rows = await listDotations({ scope: req.scope || {}, includeDeleted, limit, offset });
    return res.json(rows);
  } catch (error) {
    console.error('[routes/dotations] with-details error:', error);
    return res.status(500).json({ error: 'DOTATIONS_WITH_DETAILS_FAILED', details: error.message });
  }
});

router.get('/beneficiary/vdp/:vdpId', async (req, res) => {
  try {
    const vdpId = Number.parseInt(req.params.vdpId, 10);
    if (!vdpId) return res.status(400).json({ error: 'INVALID_VDP_ID' });
    const includeDeleted = parseBool(req.query?.includeDeleted);
    const rows = await listDotations({
      whereSql: 'vdp_id = ?',
      whereParams: [vdpId],
      scope: req.scope || {},
      includeDeleted,
      limit: parseIntParam(req.query?.limit, 500),
      offset: parseIntParam(req.query?.offset, 0),
    });
    return res.json(rows);
  } catch (error) {
    console.error('[routes/dotations] beneficiary/vdp error:', error);
    return res.status(500).json({ error: 'DOTATIONS_BY_VDP_FAILED', details: error.message });
  }
});

router.get('/beneficiary/entite/:entiteId', async (req, res) => {
  try {
    const entiteId = Number.parseInt(req.params.entiteId, 10);
    if (!entiteId) return res.status(400).json({ error: 'INVALID_ENTITE_ID' });
    const includeDeleted = parseBool(req.query?.includeDeleted);
    const rows = await listDotations({
      whereSql: 'entite_id = ?',
      whereParams: [entiteId],
      scope: req.scope || {},
      includeDeleted,
      limit: parseIntParam(req.query?.limit, 500),
      offset: parseIntParam(req.query?.offset, 0),
    });
    return res.json(rows);
  } catch (error) {
    console.error('[routes/dotations] beneficiary/entite error:', error);
    return res.status(500).json({ error: 'DOTATIONS_BY_ENTITE_FAILED', details: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const includeDeleted = parseBool(req.query?.includeDeleted);
    const limit = parseIntParam(req.query?.limit, 500);
    const offset = parseIntParam(req.query?.offset, 0);
    const rows = await listDotations({ scope: req.scope || {}, includeDeleted, limit, offset });
    return res.json(rows);
  } catch (error) {
    console.error('[routes/dotations] list error:', error);
    return res.status(500).json({ error: 'DOTATIONS_LIST_FAILED', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const dotationId = Number.parseInt(req.params.id, 10);
    if (!dotationId) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });
    const scope = req.scope || {};
    const inScope = await ensureDotationInScope(dotationId, scope);
    if (!inScope) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });
    const dotation = await getDotationWithItems(dotationId);
    if (!dotation) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
    return res.json(dotation);
  } catch (error) {
    console.error('[routes/dotations] detail error:', error);
    return res.status(500).json({ error: 'DOTATION_DETAIL_FAILED', details: error.message });
  }
});

// --- Items helpers (utilisés par l'UI) ---

router.post('/:id/items', async (req, res) => {
  const dotationId = Number.parseInt(req.params.id, 10);
  if (!dotationId) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  const scope = req.scope || {};
  const inScope = await ensureDotationInScope(dotationId, scope);
  if (!inScope) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  try {
    await run('BEGIN TRANSACTION;');
    await upsertDotationItems(dotationId, items);
    await run('COMMIT;');
    const dotation = await getDotationWithItems(dotationId);
    if (!dotation) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
    return res.status(200).json({ dotation, items: dotation?.items || [] });
  } catch (error) {
    await run('ROLLBACK;').catch(() => null);
    console.error('[routes/dotations] add items error:', error);
    return res.status(500).json({ error: 'DOTATION_ITEMS_UPDATE_FAILED', details: error.message });
  }
});

router.patch('/:dotationId/items/:itemId/status', async (req, res) => {
  const dotationId = Number.parseInt(req.params.dotationId, 10);
  const itemId = Number.parseInt(req.params.itemId, 10);
  if (!dotationId || !itemId) return res.status(400).json({ error: 'INVALID_ITEM_ID' });

  const scope = req.scope || {};
  const inScope = await ensureDotationInScope(dotationId, scope);
  if (!inScope) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const nextStatus = (req.body?.status || req.body?.statut || '').toString().trim();
  if (!nextStatus) return res.status(400).json({ error: 'INVALID_STATUS' });

  try {
    const result = await run(
      'UPDATE dotation_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND dotation_id = ?',
      [nextStatus, itemId, dotationId]
    );
    if (!result?.changes) return res.status(404).json({ error: 'DOTATION_ITEM_NOT_FOUND' });
    const dotation = await getDotationWithItems(dotationId);
    return res.status(200).json({ dotation, items: dotation?.items || [] });
  } catch (error) {
    console.error('[routes/dotations] item status error:', error);
    return res.status(500).json({ error: 'DOTATION_ITEM_STATUS_FAILED', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const dotationId = Number.parseInt(req.params.id, 10);
  if (!dotationId) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  const scope = req.scope || {};
  const inScope = await ensureDotationInScope(dotationId, scope);
  if (!inScope) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const hard = parseBool(req.query?.hard);
  try {
    await run('BEGIN TRANSACTION;');
    if (hard) {
      await run('DELETE FROM dotation_items WHERE dotation_id = ?', [dotationId]);
      const result = await run('DELETE FROM dotations WHERE id = ?', [dotationId]);
      await run('COMMIT;');
      if (!result?.changes) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
      return res.json({ ok: true, hard: true });
    }

    const result = await run('UPDATE dotations SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL', [dotationId]);
    await run('COMMIT;');
    if (!result?.changes) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });
    return res.json({ ok: true, hard: false });
  } catch (error) {
    await run('ROLLBACK;').catch(() => null);
    console.error('[routes/dotations] delete error:', error);
    return res.status(500).json({ error: 'DOTATION_DELETE_FAILED', details: error.message });
  }
});

const normalizeResourceType = (value) => {
  const raw = (value ?? '').toString().trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'materiel' || raw === 'materiel_specifique' || raw === 'materiels_specifiques') return 'materiel_specifique';
  if (raw === 'munition' || raw === 'munitions') return 'munition';
  if (raw === 'optique' || raw === 'optiques') return 'optique';
  if (raw === 'arme' || raw === 'armes') return 'arme';
  return raw;
};

const normalizeSingleDotationItem = (payload = {}) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length > 1) {
    const err = new Error('DOTATION_SINGLE_RESOURCE_ONLY');
    err.statusCode = 400;
    throw err;
  }
  if (items.length === 1) {
    const item = items[0] || {};
    return {
      resource_type: normalizeResourceType(item.resource_type ?? item.ressource_type) || 'arme',
      resource_id: item.resource_id ?? item.ressource_id ?? item.arme_id ?? item.id ?? null,
      quantite: item.quantite ?? item.quantity ?? 1,
      status: item.status || item.statut || 'assigné',
      source_arme_id: item.source_arme_id ?? null,
    };
  }

  // Payload legacy (sans items)
  const resourceType = normalizeResourceType(payload.ressource_type ?? payload.resource_type);
  const resourceId = payload.ressource_id ?? payload.resource_id ?? null;
  if (!resourceId) return null;
  return {
    resource_type: resourceType || 'arme',
    resource_id: resourceId,
    quantite: payload.quantite ?? 1,
    status: payload.status || payload.statut || 'assigné',
    source_arme_id: payload.source_arme_id ?? null,
  };
};

const upsertDotationItems = async (dotationId, items = [], { actorId = null, sourceArmeId = null } = {}) => {
  await run('DELETE FROM dotation_items WHERE dotation_id = ?', [dotationId]);
  for (const item of items) {
    if (!item || !item.resource_id) continue;
    const resourceType = normalizeResourceType(item.resource_type ?? item.ressource_type) || 'arme';
    const effectiveSourceArmeId =
      resourceType === 'arme'
        ? (item.source_arme_id ?? sourceArmeId ?? null)
        : null;

    await run(
      `
        INSERT INTO dotation_items (
          dotation_id, resource_type, resource_id, quantite, status,
          source_arme_id,
          created_by, updated_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `,
      [
        dotationId,
        resourceType,
        item.resource_id,
        item.quantite ?? 1,
        item.status || 'assigné',
        effectiveSourceArmeId,
        actorId,
        actorId
      ]
    );
  }
};

router.post('/', async (req, res) => {
  const payload = req.body || {};
  let singleItem;
  try {
    singleItem = normalizeSingleDotationItem(payload);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  if (!singleItem) {
    return res.status(400).json({ error: 'DOTATION_RESOURCE_REQUIRED' });
  }
  const items = [singleItem];

  const code = payload.code || `DOT-${Date.now()}`;
  const actorId = req.user?.id ?? null;
  applyScopeToDotationPayload(payload, req.scope || {});

  const resourceType = normalizeResourceType(singleItem.resource_type) || 'arme';
  const resourceId = singleItem.resource_id;
  const quantity = singleItem.quantite ?? 1;
  const sourceArmeId = resourceType === 'arme' ? (payload.source_arme_id ?? singleItem.source_arme_id ?? null) : null;

  try {
    await run('BEGIN TRANSACTION;');
    const { lastID } = await run(
      `
        INSERT INTO dotations (
          code, dotation_type, beneficiary_type,
          vdp_id, entite_id, sous_entite_id, coordination_id,
          lot_id, source_id, source_arme_id,
          ressource_type, ressource_id, quantite,
          code_dotation, type_dotation,
          statut,
          date_dotation, date_prevue_retour, date_cloture,
          observation, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        code,
        payload.dotation_type || 'individuelle',
        payload.beneficiary_type || 'vdp',
        payload.vdp_id ?? null,
        payload.entite_id ?? null,
        payload.sous_entite_id ?? null,
        payload.coordination_id ?? null,
        null,
        null,
        sourceArmeId,
        resourceType,
        resourceId,
        quantity,
        payload.code_dotation ?? code,
        payload.type_dotation ?? payload.dotation_type ?? null,
        payload.statut || 'en_cours',
        normalizeDate(payload.date_dotation),
        normalizeDate(payload.date_prevue_retour),
        normalizeDate(payload.date_cloture),
        payload.observation || null,
        actorId,
        actorId
      ]
    );
    await upsertDotationItems(lastID, items, { actorId, sourceArmeId });
    await run('COMMIT;');
    const dotation = await getDotationWithItems(lastID);
    return res.status(201).json({ dotation, items: dotation?.items || [] });
  } catch (error) {
    await run('ROLLBACK;').catch(() => null);
    console.error('[routes/dotations] create error:', error);
    return res.status(500).json({ error: 'DOTATION_CREATE_FAILED', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const dotationId = Number.parseInt(req.params.id, 10);
  if (!dotationId) return res.status(400).json({ error: 'INVALID_DOTATION_ID' });

  const existing = await getDotationWithItems(dotationId);
  if (!existing) return res.status(404).json({ error: 'DOTATION_NOT_FOUND' });

  const scope = req.scope || {};
  const inScope = await ensureDotationInScope(dotationId, scope);
  if (!inScope) return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });

  const payload = req.body || {};
  let singleItem;
  try {
    singleItem = normalizeSingleDotationItem(payload);
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  const items = singleItem ? [singleItem] : [];
  const actorId = req.user?.id ?? existing.updated_by ?? null;
  applyScopeToDotationPayload(payload, scope, { forceAssign: false });

  const nextResourceType = singleItem ? (normalizeResourceType(singleItem.resource_type) || 'arme') : (existing.ressource_type || existing.resource_type || null);
  const nextResourceId = singleItem ? singleItem.resource_id : (existing.ressource_id || existing.resource_id || null);
  const nextQuantity = singleItem ? (singleItem.quantite ?? 1) : (existing.quantite ?? 1);
  const nextSourceArmeId = nextResourceType === 'arme'
    ? (payload.source_arme_id ?? singleItem?.source_arme_id ?? existing.source_arme_id ?? null)
    : null;

  const fields = [
    ['code', payload.code ?? existing.code ?? `DOT-${dotationId}`],
    ['dotation_type', payload.dotation_type || existing.dotation_type],
    ['beneficiary_type', payload.beneficiary_type || existing.beneficiary_type],
    ['vdp_id', payload.vdp_id ?? null],
    ['entite_id', payload.entite_id ?? null],
    ['sous_entite_id', payload.sous_entite_id ?? null],
    ['coordination_id', payload.coordination_id ?? null],
    // Lots & sources_dotation supprimés fonctionnellement
    ['lot_id', null],
    ['source_id', null],
    ['source_arme_id', nextSourceArmeId],
    ['ressource_type', nextResourceType],
    ['ressource_id', nextResourceId],
    ['quantite', nextQuantity],
    ['code_dotation', payload.code_dotation ?? payload.code ?? existing.code_dotation ?? existing.code ?? null],
    ['type_dotation', payload.type_dotation ?? payload.dotation_type ?? existing.type_dotation ?? null],
    ['statut', payload.statut || existing.statut || 'en_cours'],
    ['date_dotation', normalizeDate(payload.date_dotation) ?? normalizeDate(existing.date_dotation)],
    ['date_prevue_retour', normalizeDate(payload.date_prevue_retour)],
    ['date_cloture', normalizeDate(payload.date_cloture)],
    ['observation', payload.observation ?? existing.observation],
    ['updated_by', actorId],
    ['updated_at', new Date().toISOString().slice(0, 19).replace('T', ' ')]
  ];

  const setClause = fields.map(([column]) => `${column} = ?`).join(', ');
  const values = fields.map(([, value]) => value);

  try {
    await run('BEGIN TRANSACTION;');
    await run(`UPDATE dotations SET ${setClause} WHERE id = ?;`, [...values, dotationId]);
    if (items.length) {
      await upsertDotationItems(dotationId, items, { actorId, sourceArmeId: nextSourceArmeId });
    }
    await run('COMMIT;');
    const dotation = await getDotationWithItems(dotationId);
    return res.status(200).json({ dotation, items: dotation?.items || [] });
  } catch (error) {
    await run('ROLLBACK;').catch(() => null);
    console.error('[routes/dotations] update error:', error);
    return res.status(500).json({ error: 'DOTATION_UPDATE_FAILED', details: error.message });
  }
});

module.exports = router;
