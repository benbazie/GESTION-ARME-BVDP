'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// ---------- Config ----------
const safeArg = (arr, prefix) => Array.isArray(arr) ? arr.find(a => typeof a === 'string' && a.startsWith(prefix)) : null
const rawArg = safeArg(process && process.argv, '--api-base-url=')
const API_BASE_URL = rawArg ? rawArg.split('=')[1] : (process.env.API_BASE_URL || 'http://localhost:3001/api')
const TOKEN_KEY = 'auth-token'
let runtimeToken = null
console.log('[preload] API_BASE_URL =', API_BASE_URL)

// ---------- Token helpers ----------
function normalizeToken(token) {
  if (!token) return null
  const raw = String(token).trim()
  return raw.startsWith('Bearer ') ? raw.slice(7) : raw
}

const authStore = { token: null };
const toBearer = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
};

function setToken(t) {
  const normalized = normalizeToken(t);
  authStore.token = normalized;
  runtimeToken = normalized;
  try {
    if (typeof localStorage !== 'undefined') {
      if (normalized) {
        localStorage.setItem(TOKEN_KEY, normalized);
        localStorage.setItem('auth_token', normalized);
        console.log('[preload] setToken: token enregistré', normalized);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('auth_token');
      }
    }
    try { ipcRenderer.invoke('set-token', normalized).catch(() => {}); } catch {}
  } catch (e) {}
  return normalized;
}
function getToken() {
  if (authStore.token) return authStore.token;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('auth_token');
      if (stored && stored.trim()) {
        return setToken(stored);
      }
    }
  } catch (e) {}
  return runtimeToken;
}
function clearToken() {
  authStore.token = null;
  runtimeToken = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('auth_token');
    }
    try { ipcRenderer.invoke('set-token', null).catch(() => {}); } catch {}
  } catch (e) {}
}

// ---------- HTTP helpers ----------
async function safeJson(res) {
  if (!res) return null
  if (res.status === 204) return null
  const txt = await res.text()
  if (!txt) return null
  try { return JSON.parse(txt) } catch { return txt }
}

const httpCall = async (method, path, body) => {
  const urlBase = String(API_BASE_URL).replace(/\/$/, '');
  const urlPath = String(path || '');
  const url = urlPath.startsWith('/') ? urlBase + urlPath : `${urlBase}/${urlPath}`;
  const opts = { method: String(method).toUpperCase(), headers: { 'Content-Type': 'application/json' } }
  const bearer = toBearer(getToken());
  if (bearer) opts.headers.Authorization = bearer

  if (opts.method === 'GET' && body && typeof body === 'object') {
    const qs = new URLSearchParams(Object.entries(body).filter(([, v]) => v != null && v !== '')).toString()
    const final = qs ? `${url}?${qs}` : url
    const res = await fetch(final, opts)
    if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err }
    return safeJson(res)
  }

  if (body != null && opts.method !== 'GET') opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err }
  return safeJson(res)
}

// ---------- Dashboard map (explicit) ----------
const DASHBOARD_MAP = {
  '/dashboard/vdp': 'dashboard:vdp',
  '/dashboard/armes': 'dashboard:armes',
  '/dashboard/munitions': 'dashboard:munitions',
  '/dashboard/munitions/summary': 'dashboard:munitionsSummary',
  '/dashboard/materiel': 'dashboard:materiel',
  '/dashboard/materiel/summary': 'dashboard:materielSummary',
  '/dashboard/dotations': 'dashboard:dotations',
  '/dashboard/armes/by-type': 'dashboard:armesByType',
  '/dashboard/armes/by-category': 'dashboard:armesByCategory',
  '/dashboard/armes/by-status': 'dashboard:armesByStatus',
  '/dashboard/armes/timeseries': 'dashboard:armesTimeseries',
  '/dashboard/munitions/by-type': 'dashboard:munitionsByType',
  '/dashboard/munitions/timeseries': 'dashboard:munitionsTimeseries',
  '/dashboard/materiel/by-type': 'dashboard:materielByType',
  '/dashboard/materiel/timeseries': 'dashboard:materielTimeseries',
  '/dashboard/dotations/by-resource': 'dashboard:dotationsByResource',
  '/dashboard/dotations/timeseries': 'dashboard:dotationsTimeseries',
  '/dashboard/vdp/by-gender': 'dashboard:vdpByGender',
  '/dashboard/vdp/by-age-group': 'dashboard:vdpByAgeGroup',
  '/dashboard/vdp/by-entity': 'dashboard:vdpByEntity',
  '/dashboard/recent-activities': 'dashboard:recentActivities'
}

// ---------- callAPI: HTTP first, IPC fallback ----------
async function callAPI(method, path, body = null) {
  try {
    return await httpCall(method, path, body);
  } catch (err) {
    if (err && typeof err.status !== "undefined" && [401, 403].includes(err.status)) {
      throw err;
    }
    throw err;
  }
}

// ---------- TABLES default (includes armes/munitions/materiel/optiques) ----------
const TABLES_FALLBACK = [
  'regions','provinces','communes','localites',
  'entites','sous_entites','coordinations',
  'config_armes','config_optiques','config_materiels','config_munitions',
  'config_arme','config_optique','config_materiel','config_munition',
  'armes','optiques','materiels_specifiques','munitions',
  'lots','transactions','sessions','dotations','consommation_munitions',
  'utilisateurs','user_roles','roles','notifications','app_config',
  'audit_logs','sync_logs','vdp','ddr_desarmement',
  'coordination_regionale','coordination_provinciale','coordination_communale'
]

let TABLES = null
try {
  if (Array.isArray(globalThis && globalThis.TABLES)) TABLES = globalThis.TABLES.slice()
  else TABLES = TABLES_FALLBACK.slice()
} catch (e) {
  TABLES = TABLES_FALLBACK.slice()
}

// ---------- helpers ----------
function toPascal(s) { return String(s).split(/[-_]/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join('') }
function toSingularPascal(s) { const p = toPascal(s); return p.endsWith('s') ? p.slice(0, -1) : p }

// ---------- build api object (fully populated before exposing) ----------
const api = {
  // auth
  login: creds => callAPI('POST', '/auth/login', creds).then(r => { if (r && r.token) setToken(r.token); return r }),
  me: () => callAPI('GET', '/auth/me'),
  logout: () => callAPI('POST', '/auth/logout').then(r => { clearToken(); return r }),
  changePassword: payload => callAPI('POST', '/auth/change-password', payload),

  // token helpers
  setToken, getToken, clearToken,

  // window controls
  quit: () => ipcRenderer.invoke('app-quit'),
  minimize: () => ipcRenderer.invoke('app-minimize'),
  maximize: () => ipcRenderer.invoke('app-maximize'),

  // raw calls
  httpCall, callAPI,

  // fetch provinces, communes, localites
  fetchProvinces: () => ipcRenderer.invoke('fetch-provinces'),
  fetchCommunes: () => ipcRenderer.invoke('fetch-communes'),
  fetchLocalites: () => ipcRenderer.invoke('fetch-localites'),

  // dotations helpers (custom endpoints)
  getDotations: api.getDotations || (params => callAPI('GET', '/dotations', params)),
  getDotationDetail: api.getDotationDetail || (id => callAPI('GET', `/dotations/${id}`)),
  createDotation: api.createDotation || (payload => callAPI('POST', '/dotations', payload)),
  updateDotation: api.updateDotation || ((id, payload) => callAPI('PUT', `/dotations/${id}`, payload)),
  addDotationItems: api.addDotationItems || ((id, items) => callAPI('POST', `/dotations/${id}/items`, { items })),
  updateDotationItemStatus: api.updateDotationItemStatus ||
    ((dotationId, itemId, payload) => callAPI('PATCH', `/dotations/${dotationId}/items/${itemId}/status`, payload)),
  deleteDotation: api.deleteDotation || ((id, options = {}) => callAPI('DELETE', `/dotations/${id}`, options)),

  // new IPC relayed endpoints
  getDotationsWithDetails: (params) => forwardApiRequest('GET', '/dotations/with-details', { params }),
  getDotationDetail: (dotationId, params) => forwardApiRequest('GET', `/dotations/${dotationId}`, { params }),
  getDotationsByVdp: (vdpId, params) => forwardApiRequest('GET', `/dotations/beneficiary/vdp/${vdpId}`, { params }),
  getDotationsByEntite: (entiteId, params) => forwardApiRequest('GET', `/dotations/beneficiary/entite/${entiteId}`, { params }),
  getLotById: (lotId, params) => forwardApiRequest('GET', `/lots/${lotId}`, { params }),
  getArmeClassifications: (params) => forwardApiRequest('GET', '/armes/classifications', { params }),
  getCategoriesArmeByType: (typeId, params) => forwardApiRequest('GET', `/armes/types/${typeId}/categories`, { params }),
  getModelesArmeByCategorie: (categorieId, params) => forwardApiRequest('GET', `/armes/categories/${categorieId}/modeles`, { params }),
  getLocalitesWithDetails: () => ipcRenderer.invoke('api-call', { method: 'GET', path: '/api/localites' }),
  getLocalites: () => ipcRenderer.invoke('api-call', { method: 'GET', path: '/api/localites' }),
  getLocalite: (id) => ipcRenderer.invoke('api-call', { method: 'GET', path: `/api/localites/${id}` }),
}

// ---------- generate CRUD helpers for TABLES ----------
for (const tbl of TABLES) {
  try {
    const P = toPascal(tbl)
    const S = P.endsWith('s') ? P.slice(0, -1) : P

    api[`get${P}List`] = (params) => callAPI('GET', `/${tbl}`, params)
    api[`get${P}`]     = (params => api[`get${P}List`](params))
    api[`get${S}`]     = (params => api[`get${P}List`](params))

    api[`get${P}ById`] = (id) => callAPI('GET', `/${tbl}/${id}`)
    api[`get${S}ById`] = (id) => api[`get${P}ById`](id)

    api[`create${P}`]  = (data) => callAPI('POST', `/${tbl}`, data)
    api[`create${S}`]  = (data => api[`create${P}`](data))

    api[`update${P}`]  = (data) => {
      const id = data && (data.id || data._id)
      return callAPI('PUT', `/${tbl}/${id}`, data)
    }
    api[`update${S}`]  = (data => api[`update${P}`](data))

    api[`delete${P}`]  = (id) => callAPI('DELETE', `/${tbl}/${id}`, null)
    api[`delete${S}`]  = (id => api[`delete${P}`](id))
  } catch (e) {
    console.warn('[preload] skipped table due to error:', tbl, e && e.message)
  }
}

// Après la génération automatique des helpers pour TABLES, ajoute explicitement :
api.addCoordinationProvinciale = api.createCoordinationProvinciale = api.createCoordinationProvinciale || (data => api.call('createCoordinationProvinciale', data));
api.addCoordinationCommunale   = api.createCoordinationCommunale   = api.createCoordinationCommunale   || (data => api.call('createCoordinationCommunale', data));

// ---------- explicit helpers for armes/munitions/materiel/optiques/lots (clarity & overrides) ----------
api.getArmesList = api.getArmesList || (params => callAPI('GET', '/armes', params))
api.getMunitionsList = api.getMunitionsList || (params => callAPI('GET', '/munitions', params))
api.getMaterielList = api.getMaterielList || (params => callAPI('GET', '/materiel', params))
api.getOptiquesList = api.getOptiquesList || (params => callAPI('GET', '/optiques', params))

api.createArme = api.createArme || (data => callAPI('POST', '/armes', data))
api.updateArme = api.updateArme || (data => callAPI('PUT', `/armes/${data.id||data._id}`, data))
api.deleteArme = api.deleteArme || (id => callAPI('DELETE', `/armes/${id}`))

api.createMunition = api.createMunition || (data => callAPI('POST', '/munitions', data))
api.updateMunition = api.updateMunition || (data => callAPI('PUT', `/munitions/${data.id||data._id}`, data))
api.deleteMunition = api.deleteMunition || (id => callAPI('DELETE', `/munitions/${id}`))

api.createMateriel = api.createMateriel || (data => callAPI('POST', '/materiel', data))
api.updateMateriel = api.updateMateriel || (data => callAPI('PUT', `/materiel/${data.id||data._id}`, data))
api.deleteMateriel = api.deleteMateriel || (id => callAPI('DELETE', `/materiel/${id}`))

api.createOptique = api.createOptique || (data => callAPI('POST', '/optiques', data))
api.updateOptique = api.updateOptique || (data => callAPI('PUT', `/optiques/${data.id||data._id}`, data))
api.deleteOptique = api.deleteOptique || (id => callAPI('DELETE', `/optiques/${id}`))

// explicit lots helpers
api.getLotsList = api.getLotsList || (params => callAPI('GET', '/lots', params))
api.getLotById = api.getLotById || (id => callAPI('GET', `/lots/${id}`))
api.createLot = api.createLot || (data => callAPI('POST', '/lots', data))
api.updateLot = api.updateLot || (data => callAPI('PUT', `/lots/${data.id||data._id}`, data))
api.deleteLot = api.deleteLot || (id => callAPI('DELETE', `/lots/${id}`))
api.saveLot = api.saveLot || (data => (data && (data.id||data._id)) ? api.updateLot(data) : api.createLot(data))

// ---------- dashboard helpers (explicit) ----------
const dashboardApi = {
  getDashboardArmes: params => callAPI('GET', '/dashboard/armes', params),
  getDashboardMunitions: params => callAPI('GET', '/dashboard/munitions', params),
  getDashboardMunitionsSummary: params => callAPI('GET', '/dashboard/munitions/summary', params),
  getDashboardMateriel: params => callAPI('GET', '/dashboard/materiel', params),
  getDashboardMaterielSummary: params => callAPI('GET', '/dashboard/materiel/summary', params),
  getDashboardDotations: params => callAPI('GET', '/dashboard/dotations', params),
  getDashboardVdp: params => callAPI('GET', '/dashboard/vdp', params),

  getDashboardArmesByType: params => callAPI('GET', '/dashboard/armes/by-type', params),
  getDashboardArmesByCategory: params => callAPI('GET', '/dashboard/armes/by-category', params),
  getDashboardArmesByStatus: params => callAPI('GET', '/dashboard/armes/by-status', params),
  getDashboardArmesTimeseries: params => callAPI('GET', '/dashboard/armes/timeseries', params),

  getDashboardMunitionsByType: params => callAPI('GET', '/dashboard/munitions/by-type', params),
  getDashboardMunitionsTimeseries: params => callAPI('GET', '/dashboard/munitions/timeseries', params),

  getDashboardMaterielByType: params => callAPI('GET', '/dashboard/materiel/by-type', params),
  getDashboardMaterielTimeseries: params => callAPI('GET', '/dashboard/materiel/timeseries', params),

  getDashboardDotationsByResource: params => callAPI('GET', '/dashboard/dotations/by-resource', params),
  getDashboardDotationsTimeseries: params => callAPI('GET', '/dashboard/dotations/timeseries', params),

  getDashboardVdpByGender: params => callAPI('GET', '/dashboard/vdp/by-gender', params),
  getDashboardVdpByAgeGroup: params => callAPI('GET', '/dashboard/vdp/by-age-group', params),
  getDashboardVdpByEntity: params => callAPI('GET', '/dashboard/vdp/by-entity', params),
}

// merge dashboardApi into api defensively
for (const k of Object.keys(dashboardApi)) {
  if (!(k in api)) api[k] = dashboardApi[k]
}

// ---------- compatibility aliases ----------
(function buildAliases() {
  const registered = new Set(Object.keys(api))
  const makeVariantsForTable = (tbl) => {
    const pascal = toPascal(tbl)
    const sing = toSingularPascal(tbl)
    const variants = new Set([
      pascal, sing,
      `get${pascal}List`, `get${sing}List`,
      `get${pascal}`, `get${sing}`,
      `get${pascal}ById`, `get${sing}ById`,
      `create${pascal}`, `create${sing}`,
      `update${pascal}`, `update${sing}`,
      `delete${pascal}`, `delete${sing}`
    ])
    return Array.from(variants)
  }

  for (const tbl of TABLES) {
    const variants = makeVariantsForTable(tbl)
    const pascal = toPascal(tbl)
    const fallbackList = `get${pascal}List`

    for (const name of variants) {
      if (!registered.has(name)) {
        if (typeof api[fallbackList] === 'function') {
          api[name] = api[fallbackList]
        } else {
          if (/List$/.test(name) || /^get/.test(name)) api[name] = (...a) => Promise.resolve([])
          else if (/ById$/.test(name)) api[name] = (id) => Promise.resolve(null)
          else api[name] = (...a) => Promise.resolve(null)
        }
        registered.add(name)
      }
    }
  }
})()

// ---------- legacy call wrapper ----------
api.call = async (name, ...args) => {
  if (!name) return null
  if (typeof api[name] === 'function') return api[name](...args)
  const norm = String(name).replace(/[-_]/g, '').toLowerCase()
  const foundKey = Object.keys(api).find(k => k.replace(/[-_]/g, '').toLowerCase() === norm)
  if (foundKey && typeof api[foundKey] === 'function') return api[foundKey](...args)
  return Promise.resolve(null)
}

api.debugTokenState = async () => {
  let stored = null
  try { stored = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('auth_token') || null } catch {}
  const bridge = await waitForElectronAPI()
  let bridgeToken = null
  try {
    if (bridge && typeof bridge.getToken === 'function') bridgeToken = await bridge.getToken()
    else if (bridge && typeof bridge.call === 'function') bridgeToken = await bridge.call('getToken')
  } catch {}
  return {
    stored,
    runtime: runtimeToken,
    bridge: bridgeToken
  }
}

// ---------- finalize and expose safely (expose a fully-built object) ----------
let bridgeToExpose = null;
try {
  console.log('[preload] api extensible?', Object.isExtensible(api))
  bridgeToExpose = Object.isExtensible(api) ? api : Object.assign({}, api)

  // attempt to expose; if electronAPI already exists and is non-configurable, do NOT overwrite
  let desc = null
  try { desc = Object.getOwnPropertyDescriptor(globalThis, 'electronAPI') } catch (e) { desc = null }
  const canReplace = !desc || desc.configurable === true || desc.writable === true

  if (canReplace) {
    contextBridge.exposeInMainWorld('electronAPI', {
      ...bridgeToExpose,
      resetDatabase: (options) => ipcRenderer.invoke('db-reset', options ?? {}),
    })
  } else {
    // do not overwrite: populate safeElectronAPI and _electronAPIProxy for runtime consumers
    try { if (!globalThis.safeElectronAPI) globalThis.safeElectronAPI = {} } catch (e) {}
    Object.keys(bridgeToExpose).forEach(k => { try { if (typeof globalThis.safeElectronAPI[k] !== 'function') globalThis.safeElectronAPI[k] = bridgeToExpose[k] } catch(e){} })

    try {
      const existing = globalThis.electronAPI
      if (!globalThis._electronAPIProxy) {
        globalThis._electronAPIProxy = new Proxy({}, {
          get(_, prop) {
            if (existing && prop in existing) {
              const v = existing[prop]; return typeof v === 'function' ? v.bind(existing) : v
            }
            if (prop in bridgeToExpose) return bridgeToExpose[prop]
            return undefined
          },
          has(_, prop) { return (existing && prop in existing) || (prop in bridgeToExpose) },
          ownKeys() { return Array.from(new Set([...(Object.keys(existing || {})), ...Object.keys(bridgeToExpose)])) },
          getOwnPropertyDescriptor(_, prop) {
            if (existing && prop in existing) return Object.getOwnPropertyDescriptor(existing, prop) || { configurable: true, enumerable: true, value: existing[prop] }
            if (prop in bridgeToExpose) return { configurable: true, enumerable: true, value: bridgeToExpose[prop] }
            return undefined
          }
        })
      }
    } catch (e) {}
  }

} catch (e) {
  if (!/existing property/i.test(String(e && e.message || ''))) throw e
  try { console.warn('[preload] electronAPI already present, skipping overwrite') } catch {}
}

console.log('[preload] electronAPI ready →', Object.keys(api).slice(0,200).join(', '))

// Ajoute explicitement addVdp à l'API exposée
api.addVdp = api.createVdp || ((data) => callAPI('POST', '/vdp', data));

const exposedApi = { ...(bridgeToExpose || api) };
contextBridge.exposeInMainWorld('api', exposedApi);
