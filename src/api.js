
import axios from 'axios'

/* ---------- Configuration ---------- */
const FALLBACK_BASE = 'http://localhost:3001/api';

const getApiBaseFromQuery = () => {
  try {
    const params = new URL(window.location.href).searchParams;
    return params.get('apiBaseUrl') || params.get('api_base_url');
  } catch {
    return null;
  }
};

const getApiBaseFromStorage = () => {
  try {
    return localStorage.getItem('api-base-url');
  } catch {
    return null;
  }
};

const persistApiBaseToStorage = (value) => {
  if (!value) return;
  try {
    localStorage.setItem('api-base-url', value);
  } catch {
  }
};

const sanitizeBaseUrl = (value) => (typeof value === 'string' ? value.replace(/\/+$/, '') : value);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const TRUSTED_TUNNEL_HOSTS = new Set(['undutifully-philhellenic-cinda.ngrok-free.dev']);
const TRUSTED_TUNNEL_SUFFIXES = ['.ngrok-free.dev'];
const isTrustedTunnelHost = (host) =>
  !!host &&
  (TRUSTED_TUNNEL_HOSTS.has(host) ||
    TRUSTED_TUNNEL_SUFFIXES.some((suffix) => host.endsWith(suffix)));

const getHostname = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

const adjustForRuntimeHost = (candidate) => {
  if (!candidate) return null;
  const sanitized = sanitizeBaseUrl(candidate);
  if (typeof window === 'undefined') return sanitized;

  const runtimeProto = window.location?.protocol || 'http:';
  const runtimeHost = window.location?.hostname || '';
  const runtimePort = window.location?.port || '';
  const defaultApiPort =
    import.meta?.env?.VITE_API_PORT ||
    window.env?.API_PORT ||
    '3001';
  const enforceTunnelBase = (host, proto = runtimeProto) => {
    const forced = sanitizeBaseUrl(`${proto}//${host}/api`);
    persistApiBaseToStorage(forced);
    return forced;
  };

  if (isTrustedTunnelHost(runtimeHost)) {
    return enforceTunnelBase(runtimeHost);
  }

  try {
    const candidateUrl = new URL(sanitized);
    const storedHost = candidateUrl.hostname;
    const storedPort = candidateUrl.port;
    if (isTrustedTunnelHost(storedHost)) {
      return enforceTunnelBase(storedHost, candidateUrl.protocol || runtimeProto);
    }

    if (
      runtimeHost &&
      !LOOPBACK_HOSTS.has(runtimeHost) &&
      LOOPBACK_HOSTS.has(storedHost || '')
    ) {
      const runtimeBase = sanitizeBaseUrl(`${runtimeProto}//${window.location.host}/api`);
      persistApiBaseToStorage(runtimeBase);
      return runtimeBase;
    }
    const sameHost = runtimeHost && storedHost === runtimeHost;
    const shouldDropPort =
      sameHost &&
      !LOOPBACK_HOSTS.has(runtimeHost) &&
      (!runtimePort || runtimePort === '') &&
      storedPort &&
      storedPort === String(defaultApiPort);

    if (shouldDropPort) {
      const rebuilt = sanitizeBaseUrl(`${runtimeProto}//${runtimeHost}/api`);
      persistApiBaseToStorage(rebuilt);
      return rebuilt;
    }
  } catch {
    /* ignore parse errors */
  }

  return sanitized;
};

const resolveBrowserBase = () => {
  if (typeof window !== 'undefined') {
    const proto = window.location?.protocol || 'http:';
    const hostname = window.location?.hostname || '';
    const hostWithPort = window.location?.host || '';
    const originBase = hostWithPort && proto.startsWith('http')
      ? sanitizeBaseUrl(`${proto}//${hostWithPort}/api`)
      : null;
    const targetPort = import.meta?.env?.VITE_API_PORT || window.env?.API_PORT || '3001';

    const fromQuery = getApiBaseFromQuery();
    if (fromQuery) {
      const cleaned = sanitizeBaseUrl(fromQuery);
      persistApiBaseToStorage(cleaned);
      return cleaned;
    }

    if (window.env?.API_BASE_URL) {
      const adjusted = adjustForRuntimeHost(window.env.API_BASE_URL);
      if (adjusted) return adjusted;
    }

    if (import.meta?.env?.VITE_API_BASE_URL) {
      const adjusted = adjustForRuntimeHost(import.meta.env.VITE_API_BASE_URL);
      if (adjusted) return adjusted;
    }

    const fromStorage = getApiBaseFromStorage();
    if (fromStorage) {
      const adjusted = adjustForRuntimeHost(fromStorage);
      if (adjusted) return adjusted;
    }

    if (proto === 'http:' || proto === 'https:') {
      const runtimeIsLoopback = LOOPBACK_HOSTS.has(hostname || '');
      if (originBase && !runtimeIsLoopback) {
        persistApiBaseToStorage(originBase);
        return originBase;
      }

      const originPort = window.location.port;
      if (originBase && originPort && originPort === String(targetPort)) {
        persistApiBaseToStorage(originBase);
        return originBase;
      }

      if (runtimeIsLoopback && hostname) {
        const loopbackCandidate = sanitizeBaseUrl(`${proto}//${hostname}:${targetPort}/api`);
        persistApiBaseToStorage(loopbackCandidate);
        return loopbackCandidate;
      }

      if (originBase) {
        persistApiBaseToStorage(originBase);
        return originBase;
      }

      if (hostname) {
        const fallbackCandidate = runtimeIsLoopback
          ? sanitizeBaseUrl(`${proto}//${hostname}:${targetPort}/api`)
          : sanitizeBaseUrl(`${proto}//${hostname}/api`);
        persistApiBaseToStorage(fallbackCandidate);
        return fallbackCandidate;
      }
    }

    if (hostname && hostname !== 'localhost') {
      const candidate = sanitizeBaseUrl(`${proto}//${hostname}/api`);
      persistApiBaseToStorage(candidate);
      return candidate;
    }
  }

  if (typeof process !== 'undefined' && process.env?.API_BASE_URL) {
    return sanitizeBaseUrl(process.env.API_BASE_URL);
  }
  return FALLBACK_BASE;
};

const baseURL = resolveBrowserBase();
const trimmedBaseURL = String(baseURL).replace(/\/+$/, '')
console.log('[src/api] baseURL =', trimmedBaseURL)

const API = axios.create({
  baseURL: trimmedBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
})
const client = API;

const TOKEN_KEY = 'jwt';
let authToken = localStorage.getItem(TOKEN_KEY) || null;
if (authToken) {
  API.defaults.headers.common.Authorization = `Bearer ${authToken}`;
}

const applyAuthHeader = (config) => {
  const token = authToken || localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

export const setToken = (token) => {
  authToken = token || null;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    API.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete API.defaults.headers.common.Authorization;
  }
};

export const getToken = () => authToken || localStorage.getItem(TOKEN_KEY);

API.interceptors.request.use(applyAuthHeader);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      console.warn(
        `[src/api] 401 reçu sur ${error.config?.url}`,
        'Authorization header présent ?',
        !!error.config?.headers?.Authorization
      );
    }
    return Promise.reject(error);
  }
)

/* ---------- Helpers ---------- */
function withLeadingSlash(path) { return path && path.startsWith('/') ? path : `/${path}` }
function cleanParams(payload) {
  return payload && typeof payload === 'object'
    ? Object.fromEntries(Object.entries(payload).filter(([_, v]) => v != null && v !== ''))
    : payload
}

export async function pushTokenToBridge(token) {
  // Only call Electron bridge directly, not via api.call
  if (window.electron && window.electron.invoke) {
    try {
      await window.electron.invoke('set-token', token);
    } catch (e) {
      console.warn('[api.pushTokenToBridge] tentative échouée', e);
    }
  }
}

/* ---------- Low-level call using axios ---------- */
async function call(method, path, payload) {
  const url = withLeadingSlash(path)
  const m = String(method || 'get').toLowerCase()
  const opts = { method: m.toUpperCase(), url, ...(m === 'get' ? { params: cleanParams(payload) } : { data: payload }) }
  const res = await API.request(opts)
  return res && res.data !== undefined ? res.data : res
}

const normalizeArrayResponse = (value) => {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

/* ---------- Core api object (HTTP fallback) ---------- */
const api = {
  call, // generic
  // auth
  login: async creds => {
    const res = await call('post', '/auth/login', creds)
    const token = res && (res.token || res.accessToken || res.jwt)
    if (!token) throw new Error('Aucun token renvoyé par le serveur')
    const user = res.user || res.userInfo || null
    try { 
      localStorage.setItem('auth-token', token); 
      localStorage.setItem('auth_token', token);
      console.log('[api.js] Token stocké après login:', token); // <-- Ajoute ce log
    } catch {}
    setToken(token);
    try { await pushTokenToBridge(token) } catch {}
    return { token, user }
  },
  logout: () => {
    try { localStorage.removeItem('auth-token'); localStorage.removeItem('auth_token') } catch {}
    setToken(null);
    pushTokenToBridge(null).catch(() => {})
    return call('post', '/auth/logout').catch(() => null)
  },
  changePassword: (payload) => call('post', '/auth/change-password', payload),
  me: () => call('get', '/auth/me'),

  // convenience lookups
  getProvincesWithRegions:    () => call('get', '/provinces-with-regions'),
  getCommunesWithProvinces:   () => call('get', '/communes-with-provinces'),
  getLocalitesWithCommunes:   () => call('get', '/localites-with-communes'),
  getVdpsWithLocalites:       () => call('get', '/vdp-with-localites'),
  getVdps:                    () => call('get', '/vdp'),
  getArmesWithConfig:         async (params) => {
    try {
      return await call("get", "/armes-with-config", params);
    } catch (error) {
      if (error?.response?.status === 404) {
        try {
          return await call("get", "/armes", params);
        } catch (fallbackError) {
          if (fallbackError?.response?.status === 404) {
            return [];
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  },
  getArmes:                    async (params) => {
    try {
      return await call("get", "/armes", params);
    } catch (error) {
      if (error?.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },
  getDotationsWithDetails:    async (params = {}) => {
    const { data } = await client.get('/dotations/with-details', { params });
    return data;
  },
  getDotationDetail: async (dotationId, params = {}) => {
    const { data } = await client.get(`/dotations/${dotationId}`, { params });
    return data;
  },
  getDotationsByVdp: async (vdpId, params = {}) => {
    const { data } = await client.get(`/dotations/beneficiary/vdp/${vdpId}`, { params });
    return data;
  },
  getDotationsByEntite: async (entiteId, params = {}) => {
    const { data } = await client.get(`/dotations/beneficiary/entite/${entiteId}`, { params });
    return data;
  },
  getLotById: async (lotId, params = {}) => {
    if (lotId === undefined || lotId === null) return null;
    const { data } = await client.get(`/lots/${lotId}`, { params });
    return data;
  },
  getSourcesArmement: async (params = {}) => {
    const { data } = await client.get('/sources_armes', { params });
    return data;
  },
  getSourceArmement: async (id, params = {}) => {
    const { data } = await client.get(`/sources_armes/${id}`, { params });
    return data;
  },
  createSourceArmement: async (payload) => {
    const { data } = await client.post('/sources_armes', payload);
    return data;
  },
  updateSourceArmement: async (id, payload) => {
    const { data } = await client.put(`/sources_armes/${id}`, payload);
    return data;
  },
  deleteSourceArmement: async (id, config = {}) => {
    const { data } = await client.delete(`/sources_armes/${id}`, config);
    return data;
  },

  getUtilisateursStats: async () => call('get', '/utilisateurs/stats'),

  // dashboard convenience
  getDashboardVdp:              params => call('get', '/dashboard/vdp', params),
  getDashboardArmes:            params => call('get', '/dashboard/armes', params),
  getDashboardMunitionsSummary: params => call('get', '/dashboard/munitions/summary', params),
  getDashboardMaterielSummary:  params => call('get', '/dashboard/materiel/summary', params),
  getDashboardDotations:        params => call('get', '/dashboard/dotations', params),
  getDashboardRecentActivities: params => call('get', '/dashboard/recent-activities', params),

  getDashboardArmesByType:      params => call('get', '/dashboard/armes/by-type', params),
  getDashboardArmesByCategory:  params => call('get', '/dashboard/armes/by-category', params),
  getDashboardArmesByStatus:    params => call('get', '/dashboard/armes/by-status', params),
  getDashboardArmesTimeseries:  params => call('get', '/dashboard/armes/timeseries', params),

  getDashboardMunitionsByType:      params => call('get', '/dashboard/munitions/by-type', params),
  getDashboardMunitionsTimeseries:  params => call('get', '/dashboard/munitions/timeseries', params),

  getDashboardMaterielByType:       params => call('get', '/dashboard/materiel/by-type', params),
  getDashboardMaterielTimeseries:   params => call('get', '/dashboard/materiel/timeseries', params),

  getDashboardDotationsByResource:  params => call('get', '/dashboard/dotations/by-resource', params),
  getDashboardDotationsTimeseries:  params => call('get', '/dashboard/dotations/timeseries', params),

  getDashboardVdpByGender:       params => call('get', '/dashboard/vdp/by-gender', params),
  getDashboardVdpByAgeGroup:     params => call('get', '/dashboard/vdp/by-age-group', params),
  getDashboardVdpByEntity:       params => call('get', '/dashboard/vdp/by-entity', params),

  async searchArmes(term) {
    const query = (term || '').trim();
    if (!query) return [];
    const bridge = typeof window !== 'undefined' ? (window.electronAPI || window.safeElectronAPI) : null;
    try {
      if (bridge?.call) {
        const result = await bridge.call('get', '/armes/search', { term: query });
        return normalizeArrayResponse(result);
      }
      const result = await call('get', '/armes/search', { term: query });
      return normalizeArrayResponse(result);
    } catch (error) {
      console.error('[api] searchArmes:', error);
      return [];
    }
  },
  async searchVdp(term) {
    const query = (term || '').trim();
    if (!query) return [];
    const bridge = typeof window !== 'undefined' ? (window.electronAPI || window.safeElectronAPI) : null;
    try {
      if (bridge?.call) {
        const result = await bridge.call('get', '/vdp/search', { term: query });
        return normalizeArrayResponse(result);
      }
      const result = await call('get', '/vdp/search', { term: query });
      return normalizeArrayResponse(result);
    } catch (error) {
      console.error('[api] searchVdp:', error);
      return [];
    }
  },
  async searchEntites(term) {
    const query = (term || '').trim();
    if (!query) return [];
    const bridge = typeof window !== 'undefined' ? (window.electronAPI || window.safeElectronAPI) : null;
    try {
      if (bridge?.call) {
        const result = await bridge.call('get', '/entites/search', { term: query });
        return normalizeArrayResponse(result);
      }
      const result = await call('get', '/entites/search', { term: query });
      return normalizeArrayResponse(result);
    } catch (error) {
      console.error('[api] searchEntites:', error);
      return [];
    }
  },
  getDotations() {
    return call('get', '/dotations');
  },
  getDotationDetail(id) {
    return call('get', `/dotations/${id}`);
  },
  async getDotationsByVdp(id) {
    if (!id) return [];
    const bridge = typeof window !== 'undefined' ? (window.electronAPI || window.safeElectronAPI) : null;
    try {
      if (bridge?.call) {
        const result = await bridge.call('get', `/dotations/beneficiary/vdp/${id}`);
        return normalizeArrayResponse(result);
      }
      const response = await call('get', `/dotations/beneficiary/vdp/${id}`);
      return normalizeArrayResponse(response);
    } catch (error) {
      console.error('[api] getDotationsByVdp:', error);
      return [];
    }
  },
  async getDotationsByEntite(id) {
    if (!id) return [];
    const bridge = typeof window !== 'undefined' ? (window.electronAPI || window.safeElectronAPI) : null;
    try {
      if (bridge?.call) {
        const result = await bridge.call('get', `/dotations/beneficiary/entite/${id}`);
        return normalizeArrayResponse(result);
      }
      const response = await call('get', `/dotations/beneficiary/entite/${id}`);
      return normalizeArrayResponse(response);
    } catch (error) {
      console.error('[api] getDotationsByEntite:', error);
      return [];
    }
  },
  createDotation: async (payload) => {
    const response = await axiosInstance.post('/dotations', payload);
    return response.data;
  },
  updateDotation(id, payload) {
    return call("put", `/dotations/${id}`, payload);
  },
  deleteDotation(id) {
    return call('delete', `/dotations/${id}`);
  },
}

// Récupérer les dotations d'un VDP
api.getDotationsByVdp = async (vdpId) => {
  const response = await axios.get(`/dotations/beneficiary/vdp/${vdpId}`);
  return response.data;
};

// Récupérer une arme par ID
api.getArmeById = async (armeId) => {
  const response = await axios.get(`/armes/${armeId}`);
  return response.data;
};

// Vérification de doublon d'arme par numéro de série
api.checkDuplicate = async (numero_serie) => {
  if (!numero_serie) return null;
  try {
    const response = await client.get('/armes/check', { params: { numero_serie } });
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

// Alias pour compatibilité
api.checkArmeDuplicate = api.checkDuplicate;

/* ---------- Auto generate CRUD helpers for TABLES ---------- */
const TABLES = [
  'regions','provinces','communes','localites','entites','sous_entites','coordinations',
  'types_arme','categories_arme','modeles_arme','sources_dotation','lots',
  'conditions_techniques','provenance_tactique',
  'config_armes','config_optiques','config_materiels','config_munitions',
  'config_arme','config_optique','config_materiel','config_munition',
  'armes','optiques','materiels_specifiques','munitions',
  'transactions_munitions','dotations','dotation_history','chain_of_custody',
  'consommation_munitions','vdp',
  'utilisateurs','user_roles','roles','sessions','notifications','app_config',
  'coordination_regionale',
  'coordination_provinciale',
  'coordination_communale'
]

TABLES.forEach(table => {
  try {
    const P = table.split(/[-_/]/g).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    const S = P.endsWith('s') ? P.slice(0, -1) : P
    const route = `/${table}`

    if (!api[`get${P}List`]) api[`get${P}List`] = params => call('get', route, params)
    if (!api[`get${P}`]) api[`get${P}`] = params => api[`get${P}List`](params)
    if (!api[`get${S}`]) api[`get${S}`] = params => api[`get${P}List`](params)

    if (!api[`get${P}ById`]) api[`get${P}ById`] = id => call('get', `${route}/${id}`)
    if (!api[`get${S}ById`]) api[`get${S}ById`] = id => api[`get${P}ById`](id)

    if (!api[`create${P}`]) api[`create${P}`] = data => call('post', route, data)
    if (!api[`create${S}`]) api[`create${S}`] = data => api[`create${P}`](data)

    if (!api[`update${P}`]) api[`update${P}`] = data => {
      const id = data && (data.id || data._id)
      return call('put', `${route}/${id}`, data)
    }
    if (!api[`update${S}`]) api[`update${S}`] = data => api[`update${P}`](data)

    if (!api[`delete${P}`]) api[`delete${P}`] = id => call('delete', `${route}/${id}`)
    if (!api[`delete${S}`]) api[`delete${S}`] = id => api[`delete${P}`](id)
  } catch (e) { /* ignore individual table errors */ }
})

/* ---------- explicit helpers for armes/munitions/materiel/optiques/lots ---------- */
api.getArmesList = api.getArmesList || (params => call('get', '/armes', params))
api.getMunitionsList = api.getMunitionsList || (params => call('get', '/munitions', params))
api.getMaterielList = api.getMaterielList || (params => call('get', '/materiel', params))
api.getOptiquesList = api.getOptiquesList || (params => call('get', '/optiques', params))

api.createArme = api.createArme || (data => call('post', '/armes', data))
api.updateArme = api.updateArme || (data => call('put', `/armes/${data.id||data._id}`, data))
api.deleteArme = api.deleteArme || (id => call('delete', `/armes/${id}`))

api.createMunition = api.createMunition || (data => call('post', '/munitions', data))
api.updateMunition = api.updateMunition || (data => call('put', `/munitions/${data.id||data._id}`, data))
api.deleteMunition = api.deleteMunition || (id => call('delete', `/munitions/${id}`))

api.createMateriel = api.createMateriel || (data => call('post', '/materiel', data))
api.updateMateriel = api.updateMateriel || (data => call('put', `/materiel/${data.id||data._id}`, data))
api.deleteMateriel = api.deleteMateriel || (id => call('delete', `/materiel/${id}`))

api.createOptique = api.createOptique || (data => call('post', '/optiques', data))
api.updateOptique = api.updateOptique || (data => call('put', `/optiques/${data.id||data._id}`, data))
api.deleteOptique = api.deleteOptique || (id => call('delete', `/optiques/${id}`))

api.setToken = pushTokenToBridge

// Liste des configurations d'armes via l'endpoint REST canonique
api.getConfigArmeList = (params) =>
  call('get', '/config_armes', params).catch(() => call('get', '/config_arme', params))

const fetchListOrEmpty = async (path, params = {}) => {
  try {
    const { data } = await client.get(path, { params });
    return data ?? [];
  } catch (error) {
    if (error?.response?.status === 404) return [];
    throw error;
  }
};

const inFlightBridgeCalls = new Set();

const getBridgeList = async (methodName, params = {}) => {
  if (typeof window === "undefined") return null;
  const guardKey = methodName || "__bridge__";
  if (inFlightBridgeCalls.has(guardKey)) return null;
  inFlightBridgeCalls.add(guardKey);
  try {
    const bridge =
      window.electronAPI?.[methodName] ||
      window.safeElectronAPI?.[methodName];
    if (typeof bridge !== "function") return null;
    if (bridge === api[methodName]) return null;
    const result = await bridge(params);
    const rows = normalizeArrayResponse(result);
    return rows.length ? rows : null;
  } catch (error) {
    console.warn(`[api.js] Bridge ${methodName} échec :`, error?.message || error);
    return null;
  } finally {
    inFlightBridgeCalls.delete(guardKey);
  }
};

const buildConfigTaxonomy = async (params = {}) => {
  const rawConfigs = await api.getConfigArmeList(params).catch(() => []);
  const configs = normalizeArrayResponse(rawConfigs);
  const safe = (value) => {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
  };

  const typesMap = new Map();
  const categoriesMap = new Map();
  const modelesMap = new Map();

  configs.forEach((row) => {
    const typeLabel = safe(row.type || row.type_nom || row.type_label || row.type_code);
    const typeId = row.type_id ?? row.type_arme_id ?? typeLabel ?? null;
    const typeKey = typeId != null ? `type::${String(typeId)}` : typeLabel ? `type::${typeLabel}` : null;

    if (typeKey && !typesMap.has(typeKey)) {
      const label = typeLabel || (typeId != null ? String(typeId) : "Type");
      typesMap.set(typeKey, {
        id: typeId ?? label,
        nom: label,
        libelle: label,
        code: typeLabel || label
      });
    }

    const categorieLabel = safe(row.categorie || row.categorie_arme || row.categorie_nom);
    const categorieId = row.categorie_id ?? row.categorie_arme_id ?? categorieLabel ?? null;
    const catTypeKey = typeId ?? typeLabel ?? "__";
    const categorieKey =
      categorieId != null || categorieLabel
        ? `categorie::${catTypeKey}::${String(categorieId ?? categorieLabel)}`
        : null;

    if (categorieKey && !categoriesMap.has(categorieKey)) {
      const label = categorieLabel || (categorieId != null ? String(categorieId) : "Catégorie");
      categoriesMap.set(categorieKey, {
        id: categorieId ?? label,
        nom: label,
        libelle: label,
        type_id: typeId ?? typeLabel ?? null,
        type: typeLabel || null
      });
    }

    const modeleLabel = safe(row.designation || row.modele || row.modele_arme || row.modele_nom);
    const modeleId = row.modele_id ?? row.modele_arme_id ?? modeleLabel ?? null;
    const modTypeKey = typeId ?? typeLabel ?? "__";
    const modCatKey = categorieId ?? categorieLabel ?? "__";
    const modeleKey =
      modeleId != null || modeleLabel
        ? `modele::${modTypeKey}::${modCatKey}::${String(modeleId ?? modeleLabel)}`
        : null;

    if (modeleKey && !modelesMap.has(modeleKey)) {
      const label = modeleLabel || (modeleId != null ? String(modeleId) : "Modèle");
      modelesMap.set(modeleKey, {
        id: modeleId ?? label,
        nom: label,
        designation: label,
        categorie_id: categorieId ?? categorieLabel ?? null,
        categorie: categorieLabel || null,
        type_id: typeId ?? typeLabel ?? null,
        type: typeLabel || null
      });
    }
  });

  return {
    types: Array.from(typesMap.values()),
    categories: Array.from(categoriesMap.values()),
    modeles: Array.from(modelesMap.values())
  };
};

api.getTypesArmeList = async (params = {}) => {
  const bridged = await getBridgeList('getTypesArmeList', params);
  if (bridged) return bridged;
  const { types } = await buildConfigTaxonomy(params);
  return types;
};
api.createTypeArme = (payload) =>
  client.post('types_arme', payload).then((response) => response?.data);
api.updateTypeArme = (id, payload) =>
  client.put(`types_arme/${id}`, payload).then((response) => response?.data);
api.deleteTypeArme = (id, config) =>
  client.delete(`types_arme/${id}`, config).then((response) => response?.data);

api.getCategoriesArmeList = async (params = {}) => {
  const bridged = await getBridgeList('getCategoriesArmeList', params);
  if (bridged) return bridged;
  const { categories } = await buildConfigTaxonomy(params);
  return categories;
};
api.createCategorieArme = (payload) =>
  client.post('categories_arme', payload).then((response) => response?.data);
api.updateCategorieArme = (id, payload) =>
  client.put(`categories_arme/${id}`, payload).then((response) => response?.data);
api.deleteCategorieArme = (id, config) =>
  client.delete(`categories_arme/${id}`, config).then((response) => response?.data);

api.getModelesArmeList = async (params = {}) => {
  const bridged = await getBridgeList('getModelesArmeList', params);
  if (bridged) return bridged;
  const { modeles } = await buildConfigTaxonomy(params);
  return modeles;
};
api.createModeleArme = (payload) =>
  client.post('modeles_arme', payload).then((response) => response?.data);
api.updateModeleArme = (id, payload) =>
  client.put(`modeles_arme/${id}`, payload).then((response) => response?.data);
api.deleteModeleArme = (id, config) =>
  client.delete(`modeles_arme/${id}`, config).then((response) => response?.data);

/* ---------- dashboard helpers (explicit) ---------- */
const dashboardApi = {
  getDashboardArmes: params => call('get', '/dashboard/armes', params),
  getDashboardMunitions: params => call('get', '/dashboard/munitions', params),
  getDashboardMunitionsSummary: params => call('get', '/dashboard/munitions/summary', params),
  getDashboardMateriel: params => call('get', '/dashboard/materiel', params),
  getDashboardMaterielSummary: params => call('get', '/dashboard/materiel/summary', params),
  getDashboardDotations: params => call('get', '/dashboard/dotations', params),
  getDashboardVdp: params => call('get', '/dashboard/vdp', params),

  getDashboardArmesByType: params => call('get', '/dashboard/armes/by-type', params),
  getDashboardArmesByCategory: params => call('get', '/dashboard/armes/by-category', params),
  getDashboardArmesByStatus: params => call('get', '/dashboard/armes/by-status', params),
  getDashboardArmesTimeseries: params => call('get', '/dashboard/armes/timeseries', params),

  getDashboardMunitionsByType: params => call('get', '/dashboard/munitions/by-type', params),
  getDashboardMunitionsTimeseries: params => call('get', '/dashboard/munitions/timeseries', params),

  getDashboardMaterielByType: params => call('get', '/dashboard/materiel/by-type', params),
  getDashboardMaterielTimeseries: params => call('get', '/dashboard/materiel/timeseries', params),

  getDashboardDotationsByResource: params => call('get', '/dashboard/dotations/by-resource', params),
  getDashboardDotationsTimeseries: params => call('get', '/dashboard/dotations/timeseries', params),

  getDashboardVdpByGender: params => call('get', '/dashboard/vdp/by-gender', params),
  getDashboardVdpByAgeGroup: params => call('get', '/dashboard/vdp/by-age-group', params),
  getDashboardVdpByEntity: params => call('get', '/dashboard/vdp/by-entity', params)
}

for (const k of Object.keys(dashboardApi)) {
  if (!(k in api)) api[k] = dashboardApi[k]
}

/* ---------- compatibility aliases ---------- */
function toPascal(s) { return String(s).split(/[-_]/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join('') }
function toSingularPascal(s) { const p = toPascal(s); return p.endsWith('s') ? p.slice(0, -1) : p }

;(function buildAliases() {
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

/* ---------- tolerant call resolver ---------- */
api.call = (name, ...args) => {
  if (!name) return Promise.resolve(null)
  const direct = api[name]
  if (typeof direct === 'function') return direct(...args)
  const normalized = String(name).replace(/[-_]/g, '').toLowerCase()
  const aliasKey = Object.keys(api).find(k => k.replace(/[-_]/g, '').toLowerCase() === normalized)
  if (aliasKey && typeof api[aliasKey] === 'function') return api[aliasKey](...args)
  return Promise.resolve(null)
}

/* ---------- non destructive exposure (renderer-side safe install) ---------- */
try {
  // build plain bridge object from the local api object (do not mutate api)
  const toExpose = Object.assign({}, api)

  // ensure safeElectronAPI exists as an intentionally writable fallback
  try { if (!globalThis.safeElectronAPI) globalThis.safeElectronAPI = {} } catch (e) {}

  // copy any missing functions into safeElectronAPI (defensive)
  try {
    Object.keys(toExpose).forEach(k => {
      try { if (typeof globalThis.safeElectronAPI[k] !== 'function') globalThis.safeElectronAPI[k] = toExpose[k] } catch (e) {}
    })
  } catch (e) {}

  // prefer exposing via contextBridge if available (preload), otherwise try to attach non-destructively
  let desc = null
  try { desc = Object.getOwnPropertyDescriptor(globalThis, 'electronAPI') } catch (e) { desc = null }
  const canReplace = !desc || desc.configurable === true || desc.writable === true

  if (canReplace && typeof window !== 'undefined') {
    // safe to assign: create merged object to avoid mutating any existing electronAPI
    try {
      const existing = (typeof globalThis.electronAPI === 'object' && globalThis.electronAPI) ? globalThis.electronAPI : {}
      const merged = Object.assign({}, toExpose, existing)
      if (typeof merged.call !== 'function') merged.call = toExpose.call || (async () => null)
      try { globalThis.electronAPI = merged } catch (e) { /* fallback handled below */ }
    } catch (e) {
      /* fallthrough: ensure safeElectronAPI already populated */
    }
  } else {
    // cannot replace: populate safeElectronAPI (done above) and expose a proxy that delegates to preload then to toExpose
    try {
      const existing = globalThis.electronAPI
      if (!globalThis._electronAPIProxy) {
        globalThis._electronAPIProxy = new Proxy({}, {
          get(_, prop) {
            if (existing && prop in existing) {
              const v = existing[prop]; return typeof v === 'function' ? v.bind(existing) : v
            }
            if (prop in toExpose) return toExpose[prop]
            return undefined
          },
          has(_, prop) { return (existing && prop in existing) || (prop in toExpose) },
          ownKeys() { return Array.from(new Set([...(Object.keys(existing || {})), ...Object.keys(toExpose)])) },
          getOwnPropertyDescriptor(_, prop) {
            if (existing && prop in existing) {
              return Object.getOwnPropertyDescriptor(existing, prop) || { configurable: true, enumerable: true, value: existing[prop] }
            }
            if (prop in toExpose) return { configurable: true, enumerable: true, value: toExpose[prop] }
            return undefined
          }
        })
      }
    } catch (e) { /* ignore proxy creation errors in restricted environments */ }
  }
} catch (e) {
  try { if (!globalThis.safeElectronAPI) globalThis.safeElectronAPI = {} } catch (e2) {}
}

console.log('[src/api] safe exposure done. Keys:', Object.keys(api).slice(0,200).join(', '))

const apiExport = Object.assign(api, {
  getLotById,
  getSourcesArmement,
  getSourceArmement,
  createSourceArmement,
  updateSourceArmement,
  deleteSourceArmement
});

export default apiExport;

// Ajout helpers explicites pour les filtres dynamiques
api.getSousEntitesByEntite = (entiteId) => api.getSousEntitesList({ entite_id: entiteId });
api.getSousCoordinationsByCoordination = (coordinationId) => api.getCoordinationsList({ parent_id: coordinationId });
api.getLocalitesByCommune = (communeId) => api.getLocalitesList({ commune_id: communeId });

api.getCoordinationRegionalesByEntite = (entiteId) =>
  api.getCoordinationRegionaleList({ entite_id: entiteId });
api.getCoordinationProvincialesByRegionale = (coordinationRegionaleId) =>
  api.getCoordinationProvincialeList({ parent_id: coordinationRegionaleId });
api.getCoordinationCommunalesByProvinciale = (coordinationProvincialeId) =>
  api.getCoordinationCommunaleList({ parent_id: coordinationProvincialeId });

api.getLocalitesByCoordinationCommunale = async (coordinationCommuneId, params = {}) => {
  if (!coordinationCommuneId) return [];
  try {
    const result = await call('get', `/coordinations/localites/${coordinationCommuneId}`, params);
    return normalizeArrayResponse(result);
  } catch (error) {
    console.warn('[api] getLocalitesByCoordinationCommunale:', error?.message || error);
    return [];
  }
};

console.log("[api.js] Fonctions API disponibles :", Object.keys(api).filter(k => k.toLowerCase().includes('coordination')));

/* ---------- Ajout explicite des alias de création pour les coordinations ---------- */
api.addCoordinationRegionale   = api.createCoordinationRegionale   = api.createCoordinationRegionale   || (data => api.call('createCoordinationRegionale', data));
api.addCoordinationProvinciale = api.createCoordinationProvinciale = api.createCoordinationProvinciale || (data => api.call('createCoordinationProvinciale', data));
api.addCoordinationCommunale   = api.createCoordinationCommunale   = api.createCoordinationCommunale   || (data => api.call('createCoordinationCommunale', data));

// Ajoute explicitement l'alias addVdp pour la création d'un VDP
api.addVdp = api.createVdp = api.createVdp || (data => api.call('post', '/vdp', data));

// --- Ajout : helpers compatibles Electron/Web pour regions/provinces/communes/localites ---
export function fetchRegions() {
  if (typeof api.getRegionsList === 'function') {
    return api.getRegionsList();
  }
  return API.get('/regions').then(r => r.data);
}
export function fetchProvinces() {
  if (typeof api.getProvincesList === 'function') {
    return api.getProvincesList();
  }
  return API.get('/provinces').then(r => r.data);
}
export function fetchCommunes() {
  if (typeof api.getCommunesList === 'function') {
    return api.getCommunesList();
  }
  return API.get('/communes').then(r => r.data);
}
export function fetchLocalites() {
  if (typeof api.getLocalitesList === 'function') {
    return api.getLocalitesList();
  }
  return API.get('/localites').then(r => r.data);
}

// Ajout d'un helper pour réinitialiser la base de données
api.resetDatabase = async (options = {}) => {
  const bridge =
    (typeof window !== "undefined" && window.electronAPI?.resetDatabase) ||
    (typeof window !== "undefined" && window.safeElectronAPI?.resetDatabase);
  if (!bridge) throw new Error("Fonction resetDatabase indisponible.");
  return bridge(options);
};

// Compatibilité : exposer aussi les helpers sur l’objet api
api.fetchRegions = fetchRegions;
api.fetchProvinces = fetchProvinces;
api.fetchCommunes = fetchCommunes;
api.fetchLocalites = fetchLocalites;

// Dotation API helpers
const dotationApi = {
  updateDotationItemStatus: (dotationId, itemId, payload) => 
    call('patch', `/dotations/${dotationId}/items/${itemId}/status`, payload),
  deleteDotation: (id, options = {}) => call('delete', `/dotations/${id}`, options)
};
Object.assign(api, dotationApi);

const normalizeDotationPayload = (input = {}) => {
  const beneficiaryRaw = (input.beneficiary_type || input.beneficiaryType || '').toString().toLowerCase();
  const beneficiary_type = beneficiaryRaw === 'entite' ? 'entite' : 'vdp';
  const typeRaw = (input.dotation_type || input.dotationType || '').toString().toLowerCase();
  const dotation_type =
    typeRaw === 'collective'
      ? 'collective'
      : beneficiary_type === 'entite'
      ? 'collective'
      : 'individuelle';
  const normalized = { beneficiary_type, dotation_type };
  const lotCandidate =
    input.lot_id ??
    (typeof input.lot === 'object' ? input.lot?.id : input.lot ?? null);
  if (lotCandidate != null) normalized.lot_id = lotCandidate;
  if (input.source_id != null) normalized.source_id = input.source_id;
  return normalized;
};

api.createDotation = (payload = {}) => {
  const data = { ...payload, ...normalizeDotationPayload(payload) };
  delete data.lot;
  delete data.source;
  return call("post", "/dotations", data);
};

api.updateDotation = (id, payload = {}) => {
  const resolvedId = id ?? payload.id ?? payload._id;
  const data = { ...payload, ...normalizeDotationPayload(payload) };
  delete data.lot;
  delete data.source;
  return call("put", `/dotations/${resolvedId}`, data);
};

export async function getLotById(lotId, params = {}) {
  if (lotId === undefined || lotId === null) return null;
  const { data } = await client.get(`/lots/${lotId}`, { params });
  return data;
}

export async function getSourcesArmement(params = {}) {
  const { data } = await client.get('/sources_armes', { params });
  return data;
}

export async function getSourceArmement(id, params = {}) {
  const { data } = await client.get(`/sources_armes/${id}`, { params });
  return data;
}

export async function createSourceArmement(payload) {
  const { data } = await client.post('/sources_armes', payload);
  return data;
}

export async function updateSourceArmement(id, payload) {
  const { data } = await client.put(`/sources_armes/${id}`, payload);
  return data;
}

export async function deleteSourceArmement(id, config = {}) {
  const { data } = await client.delete(`/sources_armes/${id}`, config);
  return data;
}

api.getCommunesWithDetails = (params = {}) =>
  call('get', '/communes-with-provinces', params);

api.getLocalitesWithDetails = (params = {}) =>
  call('get', '/localites', params);

// Ajout de la fonction manquante getLocalites
api.getLocalites = (params = {}) =>
  call('get', '/localites', params);

const coerceId = (value) => {
  if (value && typeof value === 'object') {
    return value.id ?? value._id ?? value.value ?? value.key ?? null;
  }
  return value;
};

api.deleteLocalite = (input, options = {}) => {
  const id = coerceId(input);
  if (id == null) return Promise.reject(new Error('Identifiant localité manquant.'));
  const hardFlag = options.hard ?? true;
  const suffix = hardFlag ? '?hard=true' : '';
  return call('delete', `/localites/${id}${suffix}`);
};

API.resetUserPassword = (id, newPassword) =>
  call('put', `/utilisateurs/${id}/password`, { newPassword });

API.getActiveSessions = () => call('get', '/sessions/active');
