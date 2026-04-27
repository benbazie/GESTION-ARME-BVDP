// server.js
'use strict'

const path    = require('path')
const fs      = require('fs')

// Charge .env puis .env.local (la variante locale doit pouvoir surcharger)
try {
  const dotenv = require('dotenv');
  const cwdEnv = path.resolve(process.cwd(), '.env');
  const cwdEnvLocal = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(cwdEnv)) dotenv.config({ path: cwdEnv });
  if (fs.existsSync(cwdEnvLocal)) dotenv.config({ path: cwdEnvLocal, override: true });
} catch (_) {
  // ignore
}

const express = require('express')
const helmet  = require('helmet')
const cors    = require('cors')
const jwt     = require('jsonwebtoken')
const bcrypt  = require('bcryptjs')
const https   = require('https');
const { promisify } = require('util');
const { extractScope, hasScope, SCOPE_KEYS } = require('./utils/scope');

const bindDbMethods = (candidate) => {
  if (!candidate) return null;
  const dbInstance =
    candidate.db && typeof candidate.db.all === 'function'
      ? candidate.db
      : candidate;
  if (!dbInstance || typeof dbInstance.all !== 'function') return null;
  candidate.db = dbInstance;
  ['run', 'get', 'all', 'prepare', 'each', 'serialize', 'parallelize', 'close'].forEach((method) => {
    if (typeof candidate[method] !== 'function' && typeof dbInstance[method] === 'function') {
      candidate[method] = dbInstance[method].bind(dbInstance);
    }
  });
  if (!candidate.default) candidate.default = candidate;
  return candidate;
};

const hydrateDbModule = () => {
  try {
    const raw = require('./database/database');
    const normalized = bindDbMethods(raw) || bindDbMethods(raw?.default);
    if (normalized) return normalized;
  } catch (err) {
    console.error('[server] Chargement database/database impossible:', err.message);
  }

  throw new Error('Database indisponible: le serveur nécessite PostgreSQL et le client n\'a pas pu être chargé.');
};

const dbModule = hydrateDbModule();
console.log('[server] DB_CLIENT env =', process.env.DB_CLIENT || process.env.DATABASE_CLIENT || '(non défini)')
console.log('[server] DB module client =', dbModule?.client || '(non défini)')
try {
  const databaseModulePath = require.resolve('./database/database');
  if (require.cache[databaseModulePath]) {
    require.cache[databaseModulePath].exports = dbModule;
  } else {
    require.cache[databaseModulePath] = {
      id: databaseModulePath,
      filename: databaseModulePath,
      loaded: true,
      exports: dbModule,
    };
  }
} catch (cacheErr) {
  console.warn('[server] Impossible de fixer le cache database/database :', cacheErr.message);
}
if (!dbModule?.db || typeof dbModule.db.all !== 'function') {
  throw new Error('database/database doit exposer un client DB via db (all/get/run/prepare).');
}

const isPostgres = true;

const tableExists = async (table) => {
  if (!table) return false;
  if (typeof dbModule.tableExists === 'function') {
    return dbModule.tableExists(table);
  }
  const row = await dbModule.get(
    "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name = ? LIMIT 1",
    [table]
  );
  return !!row;
};

const listTableColumns = async (table) => {
  if (!table) return [];
  if (typeof dbModule.listTableColumns === 'function') {
    return dbModule.listTableColumns(table);
  }
  const rows = await dbModule.all(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name = ? ORDER BY ordinal_position",
    [table]
  );
  return (rows || []).map((r) => r?.name).filter(Boolean);
};

const sanitizeDotationTriggers = () => {
  // Triggers gérés par migrations PG.
  return;
};
sanitizeDotationTriggers();

// const authMW   = require('./utils/authMiddleware') // middleware JWT/session (doit exister)
const authMW   = require('./utils/authMiddleware') // middleware JWT/session (doit exister)

const { API_HOST = '0.0.0.0', API_PORT = 3001, JWT_SECRET, JWT_EXPIRES_IN = '8h' } = process.env
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env')
  process.exit(1)
}

const app = express()
app.set('trust proxy', true)

const buildDir = path.join(__dirname, 'build')
const routesFolder = path.join(__dirname, 'routes')
const DIST_DIR = path.join(__dirname, 'dist');
const customTableRouters = new Set([]);
const DISABLED_ROUTE_FILES = new Set(['localites']);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '20mb' })) // ← augmente à '50mb' si besoin

if (process.env.DEBUG_AUTH === 'true') {
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(
        `[auth-debug] ${req.method} ${req.originalUrl}`,
        req.headers.authorization ? `Authorization: ${req.headers.authorization}` : 'Authorization: <absent>'
      );
    }
    next();
  });
}

if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir))
}

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

app.locals.db = dbModule

function tryRequire(p) {
  try { return require(p) } catch (e) { return null }
}

function normalizeRouteExport(mod) {
  if (!mod) return mod;
  if (mod && typeof mod === 'object' && 'default' in mod && mod.default) return mod.default;
  return mod;
}

let HAS_USER_ROLES = false;

(async () => {
  try {
    HAS_USER_ROLES = await tableExists('user_roles');
    console.log(`[server] Table user_roles ${HAS_USER_ROLES ? "détectée" : "absente"}.`);
  } catch (err) {
    console.warn('[server] Impossible de vérifier user_roles :', err && err.message);
  }
})();

// Tables & permissions generation
const TABLES = [
  'regions','provinces','communes','localites',
  'entites','sous_entites',
  'config_armes','config_optiques','config_materiels','config_munitions',
  'config_arme','config_optique','config_materiel','config_munition',
  'armes','optiques','munitions','materiels_specifiques',
  'lots','transactions_munitions','dotations','consommation_munitions',
  'utilisateurs','user_roles','roles','notifications','app_config','sessions','vdp','audit_logs','chain_of_custody',
  'coordination_regionale',
  'coordination_provinciale',
  'coordination_communale',
  'dotations','dotation_items','dotation_history','chain_of_custody',
  'sources_armes' // <-- ajouté pour exposer /api/sources_armes
];

const EXPORT_TABLES = [
  'regions','provinces','communes','localites',
  'coordination_regionale','coordination_provinciale','coordination_communale','localite_coordination',
  'entites','sous_entites',
  'types_arme','categories_arme','modeles_arme',
  'config_arme','config_optique','config_materiel','config_munition',
  'armes','optiques','materiels_specifiques','munitions',
  'transactions_munitions','mouvements_munitions','alertes_munitions',
  'lots','sources_dotation',
  'conditions_techniques','provenance_tactique',
  'dotations','dotation_items','dotation_history','chain_of_custody','consommation_munitions',
  'sessions','notifications','app_config',
  'utilisateurs','roles','user_roles',
  'audit_logs','sync_logs',
  'vdp'
];

const IMPORT_ORDER = [
  'regions','provinces','communes','localites',
  'coordination_regionale','coordination_provinciale','coordination_communale','localite_coordination',
  'entites','sous_entites',
  'types_arme','categories_arme','modeles_arme',
  'config_arme','config_optique','config_materiel','config_munition',
  'sources_dotation','lots',
  'conditions_techniques','provenance_tactique',
  'armes','optiques','materiels_specifiques','munitions',
  'transactions_munitions','mouvements_munitions','alertes_munitions',
  'dotations','dotation_items','dotation_history','chain_of_custody','consommation_munitions',
  'vdp',
  'roles','utilisateurs','user_roles','sessions','notifications','app_config',
  'audit_logs','sync_logs'
];
const TABLE_ALIASES = {
  config_munitions: 'config_munition',
  config_armes: 'config_arme',
  config_optiques: 'config_optique',
  config_materiels: 'config_materiel',
};
const resolveTable = (tbl) => TABLE_ALIASES[tbl] || tbl;

const tableScopeColumns = new Map();

const primeScopeColumns = (table) => {
  if (!table) return;
  const normalized = tableScopeColumns.has(table) ? table : resolveTable(table);
  if (tableScopeColumns.has(normalized) && tableScopeColumns.get(normalized) !== null) return;
  tableScopeColumns.set(normalized, null);
  listTableColumns(normalized)
    .then((cols) => {
      const available = new Set(cols || []);
      const scoped = SCOPE_KEYS.filter((col) => available.has(col));
      tableScopeColumns.set(normalized, scoped);
    })
    .catch((err) => {
      console.warn(`[scope] Impossible de lire les colonnes de ${normalized}:`, err && err.message);
      tableScopeColumns.set(normalized, []);
    });
};

const getScopeColumnsForTable = (table) => {
  const normalized = resolveTable(table);
  if (!tableScopeColumns.has(normalized)) primeScopeColumns(normalized);
  const columns = tableScopeColumns.get(normalized);
  return Array.isArray(columns) ? columns : [];
};

const buildScopeWhereClause = (table, scope = {}, alias = '') => {
  if (!hasScope(scope)) return { clause: '', params: [] };
  const columns = getScopeColumnsForTable(table);
  const usable = columns.filter((col) => scope[col] !== undefined && scope[col] !== null);
  if (!usable.length) return { clause: '', params: [] };
  const prefix = alias ? `${alias}.` : '';
  return {
    clause: usable.map((col) => `${prefix}${col} = ?`).join(' AND '),
    params: usable.map((col) => scope[col])
  };
};

if (process.env.DEBUG_SQL !== 'true') {
  TABLES.forEach((tbl) => primeScopeColumns(resolveTable(tbl)));
}

const enforceScopeOnPayload = (table, payload = {}, scope = {}, options = {}) => {
  const { forceAssign = true } = options;
  if (!payload || !hasScope(scope)) return payload;
  const columns = getScopeColumnsForTable(table);
  columns.forEach((col) => {
    if (scope[col] !== undefined && scope[col] !== null) {
      if (!forceAssign && !Object.prototype.hasOwnProperty.call(payload, col)) return;
      payload[col] = scope[col];
    }
  });
  return payload;
};

const ensureRowInScope = (table, id, scope = {}) => {
  if (!hasScope(scope)) return Promise.resolve(true);
  const columns = getScopeColumnsForTable(table);
  if (!columns.length) return Promise.resolve(true);
  const { clause, params } = buildScopeWhereClause(table, scope);
  if (!clause) return Promise.resolve(true);
  const sql = `SELECT id FROM ${table} WHERE id = ? AND ${clause} LIMIT 1`;
  return new Promise((resolve, reject) => {
    dbModule.db.get(sql, [id, ...params], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
};

function makePermissionNames(tbl) {
  return {
    read: `${tbl}_read`,
    create: `${tbl}_create`,
    update: `${tbl}_update`,
    delete: `${tbl}_delete`,
    manage: `${tbl}_manage`
  }
}

const routePermissions = {
  regions: makePermissionNames('regions'),
  provinces: makePermissionNames('provinces'),
  communes: makePermissionNames('communes'),
  localites: makePermissionNames('localites'),
  entites: makePermissionNames('entites'),
  sous_entites: makePermissionNames('sous_entites'),
  coordinations: makePermissionNames('coordinations'),
  config_armes: makePermissionNames('config_armes'),
  config_optiques: makePermissionNames('config_optiques'),
  config_materiels: makePermissionNames('config_materiels'),
  config_munitions: makePermissionNames('config_munitions'),
  config_arme: makePermissionNames('config_arme'),
  config_optique: makePermissionNames('config_optique'),
  config_materiel: makePermissionNames('config_materiel'),
  config_munition: makePermissionNames('config_munition'),
  armes: makePermissionNames('armes'),
  optiques: makePermissionNames('optiques'),
  munitions: makePermissionNames('munitions'),
  materiels_specifiques: makePermissionNames('materiels_specifiques'),
  lots: makePermissionNames('lots'),
  transactions_munitions: makePermissionNames('transactions_munitions'),
  dotations: {
    read: ['dotations_read', 'dotations_manage'],
    create: ['dotations_create', 'dotations_manage'],
    update: ['dotations_update', 'dotations_manage'],
    delete: ['dotations_delete', 'dotations_manage']
  },
  consommation_munitions: makePermissionNames('consommation_munitions'),
  utilisateurs: makePermissionNames('utilisateurs'),
  user_roles: makePermissionNames('user_roles'),
  roles: makePermissionNames('roles'),
  notifications: makePermissionNames('notifications'),
  app_config: makePermissionNames('app_config'),
  sessions: makePermissionNames('sessions'),
  vdp: makePermissionNames('vdp'),
  audit_logs: makePermissionNames('audit_logs'),
  chain_of_custody: makePermissionNames('chain_of_custody'),
  coordination_regionale: makePermissionNames('coordination_regionale'),
  coordination_provinciale: makePermissionNames('coordination_provinciale'),
  coordination_communale: makePermissionNames('coordination_communale'),
  dotations: {
    get: 'dotations_read',
    post: 'dotations_create',
    put: 'dotations_update',
    delete: 'dotations_delete'
  },
  sources_armes: makePermissionNames('sources_armes'),
  'audit': ['admin', 'auditeur'],
  'audit/dashboard': ['admin', 'auditeur'],
  'audit/table': ['admin', 'auditeur'],
  'audit/record': ['admin', 'auditeur']
};
// Force les hard delete pour ces tables (déclaré une seule fois même en hot-reload)
const FORCE_HARD_DELETE_TABLES =
  globalThis.FORCE_HARD_DELETE_TABLES ||
  (globalThis.FORCE_HARD_DELETE_TABLES = new Set(['provinces', 'communes', 'localites']));

function permissionGuard(requiredPermission) {
  if (!requiredPermission) return (req, _res, next) => next()
  const requiredList = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
  return async (req, res, next) => {
    try {
      let permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
      let roles = Array.isArray(req.user?.roles) ? req.user.roles : []

      // Compat: anciens tokens sans roles/permissions -> recharger depuis la DB
      if ((!permissions || permissions.length === 0) && req.user?.id != null) {
        permissions = await resolveUserPermissions(req.user.id).catch(() => [])
        if (req.user) req.user.permissions = permissions
      }
      if ((!roles || roles.length === 0) && req.user?.id != null) {
        const userId = req.user.id
        roles = await new Promise((resolve) => {
          const sql = `
            SELECT r.nom
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = ?
          `
          dbModule.db.all(sql, [userId], async (err, rows) => {
            if (!err) {
              const names = (rows || []).map((x) => x && x.nom).filter(Boolean)
              if (names.length) return resolve(names)
            }
            // Fallback role_id
            dbModule.db.get(
              'SELECT r.nom FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1',
              [userId],
              (_e2, row2) => resolve(row2?.nom ? [row2.nom] : [])
            )
          })
        })
        if (req.user) req.user.roles = roles
      }

      if (Array.isArray(roles) && (roles.includes('role_admin') || roles.includes('admin'))) return next()
      if (Array.isArray(permissions) && permissions.includes('*')) return next()
      if (Array.isArray(permissions) && requiredList.some((perm) => permissions.includes(perm))) return next()
      return res.status(403).json({ error: 'Accès refusé' })
    } catch (err) {
      next(err)
    }
  }
}

function parseBool(v) {
  if (v === undefined || v === null) return false
  return String(v).toLowerCase() === 'true'
}

const coerceFilterValue = (raw) => {
  if (raw === undefined || raw === null) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === '' || value === 'null' || value === 'undefined') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : String(value).trim()
}

const buildCascadeFilters = (table, query = {}) => {
  const filters = []
  const params = []
  const addEquals = (column, raw) => {
    const value = coerceFilterValue(raw)
    if (value === null) return
    filters.push(`${column} = ?`)
    params.push(value)
  }

  switch (table) {
    case 'materiels_specifiques':
    case 'optiques':
    case 'munitions': {
      const get = (snake, camel) => query[snake] ?? query[camel];
      addEquals('entite_id', get('entite_id', 'entiteId'));
      addEquals('sous_entite_id', get('sous_entite_id', 'sousEntiteId'));
      addEquals('coordination_id', get('coordination_id', 'coordinationId'));
      addEquals('region_id', get('region_id', 'regionId'));
      addEquals('province_id', get('province_id', 'provinceId'));
      addEquals('commune_id', get('commune_id', 'communeId'));
      addEquals('localite_id', get('localite_id', 'localiteId'));
      break;
    }
    case 'sous_entites':
      addEquals('entite_id', query.entite_id ?? query.entiteId)
      addEquals('region_id', query.region_id ?? query.regionId)
      addEquals('province_id', query.province_id ?? query.provinceId)
      addEquals('commune_id', query.commune_id ?? query.communeId)
      break
    case 'coordination_regionale':
      addEquals('entite_id', query.entite_id ?? query.entiteId)
      addEquals('region_id', query.region_id ?? query.regionId)
      break
    case 'coordination_provinciale':
      addEquals('parent_id', query.parent_id ?? query.parentId ?? query.coordination_regionale_id ?? query.coordinationRegionaleId)
      addEquals('region_id', query.region_id ?? query.regionId)
      addEquals('province_id', query.province_id ?? query.provinceId)
      break
    case 'coordination_communale':
      addEquals('parent_id', query.parent_id ?? query.parentId ?? query.coordination_provinciale_id ?? query.coordinationProvincialeId)
      addEquals('region_id', query.region_id ?? query.regionId)
      addEquals('province_id', query.province_id ?? query.provinceId)
      addEquals('commune_id', query.commune_id ?? query.communeId)
      break
    case 'coordinations':
      addEquals('entite_id', query.entite_id ?? query.entiteId)
      addEquals('parent_id', query.parent_id ?? query.parentId)
      break
  }

  return { filters, params }
}

const createGenericListHandler = ({ table, tbl }) => (req, res) => {
  const includeDeleted = parseBool(req.query?.includeDeleted);
  const requestScope = req.scope || {};

  if (table === 'armes') {
    const scopeWhere = buildScopeWhereClause(table, requestScope, 'a');
    const clauses = [];
    if (!includeDeleted) clauses.push('a.deleted_at IS NULL');
    if (scopeWhere.clause) clauses.push(scopeWhere.clause);
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `
      SELECT a.*, c.type AS type, c.categorie AS categorie
      FROM armes a
      LEFT JOIN config_arme c ON c.id = a.config_arme_id
      ${where}
    `;
    dbModule.db.all(query, scopeWhere.params, (err, rows) => {
      if (err) {
        console.error(`[armes] Erreur SELECT (JOIN):`, err.message);
        return res.status(500).json({ error: 'Erreur BD', detail: err.message })
      }
      res.json(rows || [])
    });
    return;
  }

  // --- UTILISATEURS : jointure avec rôles ---
  if (table === 'utilisateurs') {
    const scopeWhere = buildScopeWhereClause(table, requestScope, 'u');
    if (!HAS_USER_ROLES) {
      const clauses = [];
      if (!includeDeleted) clauses.push('u.deleted_at IS NULL');
      if (scopeWhere.clause) clauses.push(scopeWhere.clause);
      const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      const query = `
        SELECT u.*, r.nom AS role_nom, u.role_id
        FROM utilisateurs u
        LEFT JOIN roles r ON u.role_id = r.id
        ${where}
        ORDER BY u.id
      `;
      return dbModule.db.all(query, scopeWhere.params, (err, rows) => {
        if (err) {
          console.error('[utilisateurs] fallback LIST:', err.message);
          return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        }
        const sanitized = (rows || []).map(row => {
          const base = sanitizeUserRow(row);
          return {
            ...base,
            role_labels: base.role_nom ? [base.role_nom] : [],
            role_ids: base.role_id != null ? [base.role_id] : []
          };
        });
        res.json(sanitized);
      });
    }

    const clauses = [];
    if (!includeDeleted) clauses.push('u.deleted_at IS NULL');
    if (scopeWhere.clause) clauses.push(scopeWhere.clause);
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `
      SELECT
        u.*,
        GROUP_CONCAT(DISTINCT r.nom) AS roles_concat,
        GROUP_CONCAT(DISTINCT r.id)  AS role_ids_concat
      FROM utilisateurs u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r       ON r.id = ur.role_id
      ${where}
      GROUP BY u.id
    `;
    dbModule.db.all(query, scopeWhere.params, async (err, rows) => {
      if (err) {
        console.error('[utilisateurs] Erreur SELECT:', err.message);
        return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      }
      try {
        const formatted = await Promise.all(
          (rows || []).map(row =>
            fetchUserWithRoles(row.id).then(r => r || sanitizeUserRow(row))
          )
        );
        res.json(formatted);
      } catch (aggErr) {
        console.error('[utilisateurs] Agrégation:', aggErr.message);
        res.status(500).json({ error: 'Erreur BD', detail: aggErr.message });
      }
    });
    return;
  }

  const cascade = buildCascadeFilters(table, req.query || {});
  const whereParts = [...cascade.filters];
  const params = [...cascade.params];
  const scopeWhere = buildScopeWhereClause(table, requestScope);
  if (scopeWhere.clause) {
    whereParts.push(scopeWhere.clause);
    params.push(...scopeWhere.params);
  }
  if (!includeDeleted) whereParts.unshift('deleted_at IS NULL');
  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
  const sql = `SELECT * FROM ${table}${whereClause}`;

  if (process.env.DEBUG_SQL === 'true') {
    console.log(`[sql] ${tbl} ->`, sql, params);
  }

  dbModule.db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(`[${tbl}] Erreur SELECT:`, err.message, '| SQL:', sql);
      if (!includeDeleted && NO_COLUMN_REGEX.test(err.message)) {
        const fallbackWhereParts = [...cascade.filters];
        const fallbackParams = [...cascade.params];
        if (scopeWhere.clause) {
          fallbackWhereParts.push(scopeWhere.clause);
          fallbackParams.push(...scopeWhere.params);
        }
        const fallbackWhere = fallbackWhereParts.length ? ` WHERE ${fallbackWhereParts.join(' AND ')}` : '';
        const fallbackSql = `SELECT * FROM ${table}${fallbackWhere}`;
        return dbModule.db.all(fallbackSql, fallbackParams, (err2, rows2) => {
          if (err2) {
            console.error(`[${tbl}] Erreur SELECT fallback:`, err2.message, '| SQL:', fallbackSql);
            return res.status(500).json({ error: 'Erreur BD', detail: err2.message });
          }
          res.json(rows2 || []);
        });
      }
      const payload = { error: 'Erreur BD', detail: err.message };
      if (process.env.DEBUG_SQL === 'true') {
        payload.sql = sql;
        payload.params = params;
      }
      return res.status(500).json(payload);
    }
    res.json(rows || []);
  });
}

// --- GET LIST ---
// (bloc global supprimé pour éviter l’usage de mountBase hors scope)

function sanitizeUserRow(row) {
  if (!row) return row
  const { password_hash, ...rest } = row
  return rest
}

function toRoleIdArray(input) {
  if (typeof input === 'undefined' || input === null) return null
  const raw = Array.isArray(input) ? input : `${input}`.split(/[,|;]/)
  return raw
    .map(val => Number(String(val).trim()))
    .filter(val => Number.isFinite(val) && val > 0)
}

function syncUserRoles(userId, roleInput) {
  if (!HAS_USER_ROLES) return Promise.resolve();
  const roleIds = toRoleIdArray(roleInput)
  if (roleIds === null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    dbModule.db.run('DELETE FROM user_roles WHERE user_id = ?', [userId], err => {
      if (err) return reject(err)
      if (!roleIds.length) return resolve()
      const stmt = dbModule.db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)')
      roleIds.forEach(roleId => stmt.run([userId, roleId]))
      stmt.finalize(finalizeErr => finalizeErr ? reject(finalizeErr) : resolve())
    })
  })
}

function fetchUserWithRoles(userId) {
  if (!HAS_USER_ROLES) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.*, r.nom AS role_nom, u.role_id
        FROM utilisateurs u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `;
      dbModule.db.get(sql, [userId], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        const base = sanitizeUserRow(row);
        resolve({
          ...base,
          role_labels: base.role_nom ? [base.role_nom] : [],
          role_ids: base.role_id != null ? [base.role_id] : []
        });
      });
    });
  }
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        u.*,
        GROUP_CONCAT(DISTINCT r.nom) AS roles_concat,
        GROUP_CONCAT(DISTINCT r.id)  AS role_ids_concat
      FROM utilisateurs u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r       ON r.id = ur.role_id
      WHERE u.id = ?
      GROUP BY u.id
    `
    dbModule.db.get(sql, [userId], (err, row) => {
      if (err) return reject(err)
      if (!row) return resolve(null)
      const roleNames = row.roles_concat
        ? row.roles_concat.split(',').map(name => name.trim()).filter(Boolean)
        : [];
      const roleIds   = row.role_ids_concat
        ? row.role_ids_concat.split(',').map(v => Number(v)).filter(Number.isFinite)
        : [];
      const payload = {
        ...row,
        role_nom: roleNames.join(', ') || null,
        role_labels: roleNames,
        role_ids: roleIds
      }
      delete payload.roles_concat
      delete payload.role_ids_concat
      resolve(sanitizeUserRow(payload))
    })
  })
}

// Utility DB wrappers
const execAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    dbModule.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const execRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    dbModule.db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const withTransaction = async (handler) => {
  await execRun('BEGIN TRANSACTION;');
  try {
    const result = await handler();
    await execRun('COMMIT;');
    return result;
  } catch (error) {
    try { await execRun('ROLLBACK;'); } catch (_) {}
    throw error;
  }
};

function totalsForTable(tbl, includeDeleted = false) {
  const table = resolveTable(tbl);
  const where = includeDeleted ? '' : ' WHERE deleted_at IS NULL';
  return new Promise((resolve, reject) => {
    dbModule.db.get(`SELECT COUNT(*) AS total FROM ${table}${where}`, [], (err, row) => {
      if (err) return reject(err)
      resolve({ total: row ? row.total : 0 });
    });
  });
}

async function resolveUserPermissions(userId) {
  const ADMIN_ROLE_NAMES = new Set(['admin', 'role_admin']);

  const isAdminLike = (roleName = '') => {
    const normalized = String(roleName || '').trim().toLowerCase();
    if (!normalized) return false;
    if (ADMIN_ROLE_NAMES.has(normalized)) return true;
    return normalized.includes('admin');
  };

  const normalizePermissions = (rawPermissions, roleName = '') => {
    const grantAllFallback = () => (isAdminLike(roleName) ? ['*'] : []);

    if (Array.isArray(rawPermissions)) {
      const normalized = rawPermissions
        .map((value) => (typeof value === 'string' ? value.trim() : value))
        .filter((value) => typeof value === 'string' && value.length > 0);
      if (normalized.length > 0) return normalized;
      return grantAllFallback();
    }

    if (rawPermissions == null) {
      return grantAllFallback();
    }

    if (typeof rawPermissions === 'string') {
      const trimmed = rawPermissions.trim();
      if (!trimmed) {
        return grantAllFallback();
      }

      const upper = trimmed.toUpperCase();
      if (upper === 'ALL' || upper === '*') {
        return ['*'];
      }

      try {
        const parsed = JSON.parse(trimmed);
        const normalized = normalizePermissions(parsed, roleName);
        if (normalized.length > 0) return normalized;
      } catch (_) {
        // ignore
      }

      if (trimmed.includes(',')) {
        const values = trimmed
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        if (values.length > 0) return values;
      }
    }

    return grantAllFallback();
  };

  const fetchPrimaryRoleRow = () =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.nom, r.permissions
        FROM utilisateurs u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = ?
        LIMIT 1
      `;
      dbModule.db.get(sql, [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });

  const fetchPivotRoleRows = () =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.nom, r.permissions
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?
      `;
      dbModule.db.all(sql, [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

  try {
    const pivotRows = await fetchPivotRoleRows().catch(() => []);
    let permissions = [];
    for (const row of pivotRows) {
      if (!row) continue;
      permissions.push(...normalizePermissions(row.permissions, row.nom));
    }
    permissions = Array.from(new Set(permissions));
    if (permissions.length > 0) return permissions;

    const primary = await fetchPrimaryRoleRow().catch(() => null);
    if (!primary) return [];
    return Array.from(new Set(normalizePermissions(primary.permissions, primary.nom)));
  } catch (_) {
    return [];
  }
}

async function resolveUserRoleNames(userId) {
  if (userId == null) return [];

  const pivotNames = await new Promise((resolve) => {
    const sql = `
      SELECT r.nom
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `;
    dbModule.db.all(sql, [userId], (err, rows) => {
      if (err) return resolve([]);
      const names = (rows || []).map((row) => row && row.nom).filter(Boolean);
      resolve(names);
    });
  }).catch(() => []);

  if (pivotNames.length) return pivotNames;

  const primary = await new Promise((resolve) => {
    dbModule.db.get(
      'SELECT r.nom FROM utilisateurs u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1',
      [userId],
      (_err, row) => resolve(row?.nom ? [row.nom] : [])
    );
  }).catch(() => []);

  return primary;
}

// Auth router (login / me / logout) — uses utilisateurs table and sessions if present
const authRouter = express.Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'username et password requis' })

    const user = await new Promise((r, j) =>
      dbModule.db.get('SELECT * FROM utilisateurs WHERE username = ?', [username.trim()], (e, row) => e ? j(e) : r(row))
    )
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Mot de passe incorrect' })

    let permissions = await resolveUserPermissions(user.id).catch(() => [])

    const scope = extractScope(user)
    const payload = {
      id: user.id,
      username: user.username,
      roles: [],
      permissions,
      ...scope
    }

    let roleNames = await new Promise((r, j) => {
      const sql = `
        SELECT r.nom
        FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?
      `
      dbModule.db.all(sql, [user.id], (e, rows) => e ? j(e) : r((rows || []).map(x => x.nom)))
    }).catch(() => [])

    // Fallback: si aucun rôle n'est lié via user_roles, utiliser utilisateurs.role_id
    if ((!roleNames || roleNames.length === 0) && user.role_id != null) {
      const primaryRole = await new Promise((r, j) =>
        dbModule.db.get(
          'SELECT nom FROM roles WHERE id = ? LIMIT 1',
          [user.role_id],
          (e, row) => e ? j(e) : r(row)
        )
      ).catch(() => null);
      if (primaryRole?.nom) roleNames = [primaryRole.nom];
    }

    payload.roles = roleNames || []

    // Si le fallback a ramené un rôle mais pas encore de permissions, recalculer depuis role_id
    if ((!permissions || permissions.length === 0) && user.role_id != null) {
      permissions = await resolveUserPermissions(user.id).catch(() => []);
      payload.permissions = permissions;
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: payload })
  } catch (err) { next(err) }
})

authRouter.get('/me', authMW, async (req, res, next) => {
  try {
    const [perms, roleNames] = await Promise.all([
      resolveUserPermissions(req.user.id).catch(() => []),
      resolveUserRoleNames(req.user.id).catch(() => []),
    ])
    res.json({
      id: req.user.id,
      username: req.user.username,
      roles: roleNames,
      permissions: perms,
      ...extractScope(req.user || {})
    })
  } catch (e) { next(e) }
})

authRouter.post('/logout', authMW, (_req, res) => {
  res.json({ ok: true })
})

authRouter.post('/change-password', authMW, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères' })
    }
    dbModule.db.get('SELECT password_hash FROM utilisateurs WHERE id = ?', [req.user.id], async (err, row) => {
      if (err) return next(err)
      if (!row) return res.status(404).json({ error: 'Utilisateur introuvable' })
      const match = await bcrypt.compare(currentPassword, row.password_hash || '')
      if (!match) return res.status(400).json({ error: 'Mot de passe actuel invalide' })
      const hashed = await bcrypt.hash(newPassword, 10)
      dbModule.db.run(
        'UPDATE utilisateurs SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashed, req.user.id],
        updErr => updErr ? next(updErr) : res.json({ ok: true })
      )
    })
  } catch (err) {
    next(err)
  }
})

app.use('/api/auth', authRouter)

// Mount dashboard router if exists, else we will provide dashboard endpoints below
const dashboardRouter = normalizeRouteExport(tryRequire('./routes/dashboard'))
if (dashboardRouter) {
  if (typeof dashboardRouter !== 'function') {
    console.warn('[server] dashboard.js ignoré : export non valide (doit être un routeur Express callable)')
  } else {
    app.use('/api/dashboard', authMW, dashboardRouter)
  }
}

// Mount other routers in routes/ folder (skip dashboard/auth)
if (fs.existsSync(routesFolder)) {
  fs.readdirSync(routesFolder).forEach(file => {
    if (file === 'auth.js' || file === 'dashboard.js' || DISABLED_ROUTE_FILES.has(path.basename(file, '.js'))) return;
    try {
      const rPath = path.join(routesFolder, file)
      const router = normalizeRouteExport(require(rPath))
      // Express exige un middleware callable (function). Un objet { use() } n'est pas valide ici.
      if (typeof router !== 'function') {
        console.warn(`[server] ${file} ignoré : export non valide (doit être un routeur Express callable)`)
        return
      }
      const mount = `/api/${path.basename(file, '.js')}`
      app.use(mount, authMW, router)
      customTableRouters.add(path.basename(file, '.js'))
      console.log(`[server] mounted ${file} -> ${mount}`)
    } catch (e) {
      console.warn(`[server] erreur montage ${file}:`, e.message)
    }
  })
}

// Admin routes (roles, assign roles)
const adminRouter = express.Router()

adminRouter.get('/roles', authMW, permissionGuard('roles_manage'), (req, res) => {
  dbModule.db.all('SELECT id, nom, permissions FROM roles', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    const formatted = (rows || []).map(r => ({ id: r.id, nom: r.nom, permissions: (() => { try { return JSON.parse(r.permissions) } catch { return [] } })() }))
    res.json(formatted)
  })
})

adminRouter.post('/roles', authMW, permissionGuard('roles_manage'), express.json(), (req, res) => {
  const { nom, permissions } = req.body || {}
  if (!nom) return res.status(400).json({ error: 'nom requis' })
  const permsStr = JSON.stringify(Array.isArray(permissions) ? permissions : [])
  dbModule.db.run('INSERT INTO roles (nom, permissions) VALUES (?, ?)', [nom, permsStr], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    dbModule.db.get('SELECT id, nom, permissions FROM roles WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'Erreur BD', detail: e.message })
      row.permissions = (() => { try { return JSON.parse(row.permissions) } catch { return [] } })()
      res.status(201).json(row)
    })
  })
})

adminRouter.put('/roles/:id', authMW, permissionGuard('roles_manage'), express.json(), (req, res) => {
  const id = req.params.id
  const { nom, permissions } = req.body || {}
  const permsStr = JSON.stringify(Array.isArray(permissions) ? permissions : [])
  dbModule.db.run('UPDATE roles SET nom = ?, permissions = ? WHERE id = ?', [nom || null, permsStr, id], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    dbModule.db.get('SELECT id, nom, permissions FROM roles WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Erreur BD', detail: e.message })
      if (!row) return res.status(404).json({ error: 'Introuvable' })
      row.permissions = (() => { try { return JSON.parse(row.permissions) } catch { return [] } })()
      res.json(row)
    })
  })
})

adminRouter.post('/users/:id/roles', authMW, permissionGuard('roles_manage'), express.json(), (req, res) => {
  const userId = req.params.id
  const { roleId } = req.body || {}
  if (!roleId) return res.status(400).json({ error: 'roleId requis' })
  dbModule.db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ ok: true })
  })
})

adminRouter.delete('/users/:id/roles/:roleId', authMW, permissionGuard('roles_manage'), (req, res) => {
  const userId = req.params.id
  const roleId = req.params.roleId
  dbModule.db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId], function(err) {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ ok: true })
  })
})

adminRouter.put('/users/:id/password', authMW, permissionGuard('utilisateurs_manage'), express.json(), async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis (≥ 6 caractères)' });
    }
    const hashed = await bcrypt.hash(String(newPassword), 10);
    dbModule.db.run(
      'UPDATE utilisateurs SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashed, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        if (!this.changes) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json({ ok: true });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Impossible de mettre à jour le mot de passe' });
  }
});

app.use('/api/admin', adminRouter)

// Generic CRUD scaffolding for TABLES (if no custom route file)
const SKIP_GENERIC_TABLES = new Set(['dotations']);

TABLES.forEach(tbl => {
  if (SKIP_GENERIC_TABLES.has(tbl)) return;
  if (customTableRouters.has(tbl)) return;
  const perms = routePermissions[tbl] || makePermissionNames(tbl);
  const mountBase = `/api/${tbl}`;
  const table = resolveTable(tbl);
  const routeFile = path.join(routesFolder, `${tbl}.js`)
  if (fs.existsSync(routeFile) && !DISABLED_ROUTE_FILES.has(tbl)) return

  app.get(
    mountBase,
    authMW,
    permissionGuard(perms.read),
    createGenericListHandler({ table, tbl })
  )

  // --- GET BY ID ---
  app.get(`${mountBase}/:id`, authMW, permissionGuard(perms.read), (req, res) => {
    const includeDeleted = parseBool(req.query?.includeDeleted);
    const requestScope = req.scope || {};
    if (table === 'provinces') {
      const baseQuery = `
        SELECT
          p.*,
          r.nom  AS region_nom,
          r.code AS region_code
        FROM provinces p
        LEFT JOIN regions r ON r.id = p.region_id
        WHERE p.id = ?
      `;
      const scopeWhere = buildScopeWhereClause(table, requestScope, 'p');
      let query = includeDeleted ? baseQuery : `${baseQuery} AND p.deleted_at IS NULL`;
      if (scopeWhere.clause) query += ` AND ${scopeWhere.clause}`;

      dbModule.db.get(query, [req.params.id, ...scopeWhere.params], (err, row) => {
        if (err) {
          console.error('[provinces] Erreur SELECT by ID:', err.message);
          return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        }
        if (!row) return res.status(404).json({ error: 'Introuvable' });
        res.json(row);
      });
      return;
    }

    if (table === 'localites') {
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
      const scopeWhere = buildScopeWhereClause(table, requestScope, 'l');
      let query = includeDeleted ? baseQuery : `${baseQuery} AND l.deleted_at IS NULL`;
      if (scopeWhere.clause) query += ` AND ${scopeWhere.clause}`;
      dbModule.db.get(query, [req.params.id, ...scopeWhere.params], (err, row) => {
        if (err) {
          console.error('[localites] Erreur SELECT by ID:', err.message);
          return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        }
        if (!row) return res.status(404).json({ error: 'Introuvable' })
        res.json(row)
      });
      return;
    }

    // --- AUTRES TABLES ---
    const baseQuery = `SELECT * FROM ${table} WHERE id = ?`;
    const scopeWhere = buildScopeWhereClause(table, requestScope);
    let query = includeDeleted ? baseQuery : `${baseQuery} AND deleted_at IS NULL`;
    if (scopeWhere.clause) query += ` AND ${scopeWhere.clause}`;

    dbModule.db.get(query, [req.params.id, ...scopeWhere.params], (err, row) => {
      if (err) {
        console.error(`[${tbl}] Erreur SELECT by ID:`, err.message);
        if (NO_COLUMN_REGEX.test(err.message)) {
          const fallbackQuery = scopeWhere.clause ? `${baseQuery} AND ${scopeWhere.clause}` : baseQuery;
          const fallbackParams = [req.params.id, ...(scopeWhere.clause ? scopeWhere.params : [])];
          return dbModule.db.get(fallbackQuery, fallbackParams, (err2, row2) => {
            if (err2) {
              console.error(`[${tbl}] Erreur SELECT by ID fallback:`, err2.message);
              return res.status(500).json({ error: 'Erreur BD', detail: err2.message })
            }
            if (!row2) return res.status(404).json({ error: 'Introuvable' })
            res.json(row2)
          })
        }
        return res.status(500).json({ error: 'Erreur BD', detail: err.message })
      }
      if (!row) return res.status(404).json({ error: 'Introuvable' })
      res.json(row)
    })
  })

  app.post(mountBase, authMW, permissionGuard(perms.create), express.json(), (req, res) => {
    console.log(`[server] POST ${mountBase} - body:`, req.body);
    let payload = req.body || {};
    const originalPayload = { ...payload };
    const requestScope = req.scope || {};
    listTableColumns(table)
      .then(async (validCols) => {
        if (!Array.isArray(validCols)) validCols = [];
      console.log(`[server] POST ${mountBase} - colonnes valides:`, validCols);
      if (table === 'utilisateurs') {
        const username = (originalPayload.username || originalPayload.nom_utilisateur || '').trim();
        if (!username) return res.status(400).json({ error: 'username requis' });
        const rawPassword = originalPayload.password || originalPayload.mot_de_passe;
        if (!rawPassword) return res.status(400).json({ error: 'password requis' });
        payload.username = username;
        payload.password_hash = await bcrypt.hash(String(rawPassword), 10);
      }
      payload = Object.fromEntries(Object.entries(payload).filter(([k]) => validCols.includes(k)));
      payload = enforceScopeOnPayload(table, payload, requestScope);
      const cols = Object.keys(payload);
      if (!cols.length) return res.status(400).json({ error: 'Aucune donnée fournie' });

      const isMaterielSpecifique = table === 'materiels_specifiques';
      const isOptique = table === 'optiques';

      if (isMaterielSpecifique && !payload.config_materiel_id) {
        return res.status(400).json({ error: 'config_materiel_id est requis pour enregistrer un matériel spécifique.' });
      }
      if (isOptique && !payload.config_optique_id) {
        return res.status(400).json({ error: 'config_optique_id est requis pour enregistrer une optique.' });
      }

      if (table === 'armes') {
        delete payload.position_id;
      }

      // S'assure que le champ position est bien transmis
      if (!cols.includes('position') && validCols.includes('position')) payload.position = "";
      // S'assure que le champ mobilite est bien transmis
      if (!cols.includes('mobilite') && validCols.includes('mobilite')) payload.mobilite = "normale";

      const placeholders = Object.keys(payload).map(() => '?').join(',');
      const insertQuery = `INSERT INTO ${table} (${Object.keys(payload).join(',')}) VALUES (${placeholders})`;
      console.log(`[server] POST ${mountBase} - SQL:`, insertQuery, 'values:', Object.values(payload));
      dbModule.db.run(insertQuery, Object.values(payload), function(err) {
        if (err) {
          console.error(`[${tbl}] Erreur INSERT:`, err.message);
          return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        }
        console.log(`[server] POST ${mountBase} - lastID:`, this.lastID);

        const fetchInserted =
          table === 'provinces'
            ? `
                SELECT
                  p.*,
                  r.nom  AS region_nom,
                  r.code AS region_code
                FROM provinces p
                LEFT JOIN regions r ON r.id = p.region_id
                WHERE p.id = ?
              `
            : `SELECT * FROM ${table} WHERE id = ?`;

        dbModule.db.get(fetchInserted, [this.lastID], (e, row) => {
          if (e) {
            console.error(`[${tbl}] Erreur SELECT après INSERT:`, e.message);
            return res.status(500).json({ error: 'Erreur BD', detail: e.message });
          }
          if (!row) return res.status(500).json({ error: 'Enregistrement introuvable après création.' });

          const finalize = (entityName) => {
            if (table === 'utilisateurs') {
              return res.status(201).json(sanitizeUserRow(row));
            }
            if (isMaterielSpecifique || isOptique) {
              const parts = [];
              if (row.designation) parts.push(row.designation);
              if (row.numero_serie) parts.push(`S/N ${row.numero_serie}`);
              if (entityName) parts.push(entityName);
              const message = `${isMaterielSpecifique ? 'Matériel spécifique' : 'Optique'} enregistré : ${parts.join(' · ') || `ID ${row.id}`}`;
              return res.status(201).json({ ...row, _confirmation: message });
            }
            return res.status(201).json(row);
          };

          if ((isMaterielSpecifique || isOptique) && row.entite_id) {
            dbModule.db.get('SELECT nom FROM entites WHERE id = ?', [row.entite_id], (errEnt, ent) => {
              const entName = errEnt ? null : ent?.nom || null;
              finalize(entName);
            });
          } else if (table === 'utilisateurs') {
            syncUserRoles(row.id, originalPayload.role_id ?? originalPayload.roles)
              .then(() => fetchUserWithRoles(row.id))
              .then(userWithRoles => res.status(201).json(userWithRoles || sanitizeUserRow(row)))
              .catch(syncErr => {
                console.error('[utilisateurs] Sync roles:', syncErr.message);
                res.status(500).json({ error: 'Erreur BD', detail: syncErr.message });
              });
          } else {
            finalize(null);
          }
        });
      });
    });
  });

  app.put(`${mountBase}/:id`, authMW, permissionGuard(perms.update), express.json(), async (req, res) => {
    const originalPayload = { ...(req.body || {}) }
    const requestScope = req.scope || {}

    if (table === 'armes' && Object.prototype.hasOwnProperty.call(originalPayload, 'position_id')) {
      delete originalPayload.position_id
    }

    const rawPasswordSource = typeof originalPayload.password === 'string'
      ? originalPayload.password
      : typeof originalPayload.mot_de_passe === 'string'
        ? originalPayload.mot_de_passe
        : ''
    const rawPassword = rawPasswordSource.trim()
    const usernameUpdate = typeof originalPayload.username === 'string' ? originalPayload.username.trim() : undefined

    const validColumns = await listTableColumns(table).catch(() => [])

    let payload = Object.fromEntries(Object.entries(originalPayload).filter(([key]) => validColumns.includes(key)))

    let inScope = true
    try {
      inScope = await ensureRowInScope(table, req.params.id, requestScope)
    } catch (scopeErr) {
      console.error(`[${tbl}] Scope check failed:`, scopeErr.message)
      return res.status(500).json({ error: 'Erreur BD', detail: scopeErr.message })
    }
    if (!inScope) {
      return res.status(403).json({ error: 'FORBIDDEN_SCOPE' })
    }

    if (table === 'utilisateurs') {
      if (usernameUpdate !== undefined) {
        if (!usernameUpdate) return res.status(400).json({ error: 'username requis' })
        if (validColumns.includes('username')) payload.username = usernameUpdate
      }
      if (rawPassword) {
        if (!validColumns.includes('password_hash')) {
          return res.status(400).json({ error: 'Impossible de mettre à jour le mot de passe' })
        }
        payload.password_hash = await bcrypt.hash(rawPassword, 10)
      }
      delete payload.password
      delete payload.mot_de_passe
    }

    if (
      table === 'materiels_specifiques' &&
      Object.prototype.hasOwnProperty.call(originalPayload, 'config_materiel_id') &&
      !originalPayload.config_materiel_id
    ) {
      return res.status(400).json({ error: 'config_materiel_id est requis pour mettre à jour un matériel spécifique.' })
    }
    payload = enforceScopeOnPayload(table, payload, requestScope, { forceAssign: false })

    if (
      table === 'optiques' &&
      Object.prototype.hasOwnProperty.call(originalPayload, 'config_optique_id') &&
      !originalPayload.config_optique_id
    ) {
      return res.status(400).json({ error: 'config_optique_id est requis pour mettre à jour une optique.' })
    }

    const keys = Object.keys(payload)
    if (!keys.length) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' })
    }

    const assignments = keys.map(key => `${key} = ?`)
    const values = keys.map(key => payload[key])

    if (validColumns.includes('updated_at') && !keys.includes('updated_at')) {
      assignments.push('updated_at = CURRENT_TIMESTAMP')
    }

    const updateQuery = `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`
    values.push(req.params.id)

    dbModule.db.run(updateQuery, values, function(err) {
      if (err) {
        console.error(`[${tbl}] Erreur UPDATE:`, err.message)
        return res.status(500).json({ error: 'Erreur BD', detail: err.message })
      }

      const fetchUpdated =
        table === 'provinces'
          ? `
              SELECT
                p.*,
                r.nom  AS region_nom,
                r.code AS region_code
              FROM provinces p
              LEFT JOIN regions r ON r.id = p.region_id
              WHERE p.id = ?
            `
          : `SELECT * FROM ${table} WHERE id = ?`

      const sendRow = () => {
        dbModule.db.get(fetchUpdated, [req.params.id], (selectErr, row) => {
          if (selectErr) {
            console.error(`[${tbl}] Erreur SELECT après UPDATE:`, selectErr.message)
            return res.status(500).json({ error: 'Erreur BD', detail: selectErr.message })
          }
          if (!row) return res.status(404).json({ error: 'Introuvable' })

          const isMaterielSpecifique = table === 'materiels_specifiques'
          const isOptique = table === 'optiques'

          if (table === 'utilisateurs') {
            syncUserRoles(row.id, originalPayload.role_id ?? originalPayload.roles)
              .then(() => fetchUserWithRoles(row.id))
              .then(userWithRoles => res.json(userWithRoles || sanitizeUserRow(row)))
              .catch(syncErr => {
                console.error('[utilisateurs] Sync roles:', syncErr.message);
                res.status(500).json({ error: 'Erreur BD', detail: syncErr.message });
              });
            return;
          }

          if (isMaterielSpecifique || isOptique) {
            const parts = []
            if (row.designation) parts.push(row.designation)
            if (row.numero_serie) parts.push(`S/N ${row.numero_serie}`)
            const message = `${isMaterielSpecifique ? 'Matériel spécifique' : 'Optique'} mis à jour : ${parts.join(' · ') || `ID ${row.id}`}`
            return res.json({ ...row, _confirmation: message })
          }

          return res.json(row)
        })
      }

      if (!this.changes) {
        return dbModule.db.get(`SELECT id FROM ${table} WHERE id = ?`, [req.params.id], (checkErr, exists) => {
          if (checkErr) {
            console.error(`[${tbl}] Vérification après UPDATE:`, checkErr.message)
            return res.status(500).json({ error: 'Erreur BD', detail: checkErr.message })
          }
          if (!exists) return res.status(404).json({ error: 'Introuvable' })
          return sendRow()
        })
      }

      sendRow()
    })
  });

  app.delete(`${mountBase}/:id`, authMW, permissionGuard(perms.delete), async (req, res) => {
    const requestScope = req.scope || {};
    let inScope = true;
    try {
      inScope = await ensureRowInScope(table, req.params.id, requestScope);
    } catch (scopeErr) {
      console.error(`[${tbl}] Scope check failed (DELETE):`, scopeErr.message);
      return res.status(500).json({ error: 'Erreur BD', detail: scopeErr.message });
    }
    if (!inScope) {
      return res.status(403).json({ error: 'FORBIDDEN_SCOPE' });
    }

    const wantsHardDelete = parseBool(req.query?.hard) || FORCE_HARD_DELETE_TABLES.has(tbl);
    if (wantsHardDelete) {
      dbModule.db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        if (!this.changes) return res.status(404).json({ error: 'Introuvable' });
        return res.json({ ok: true, id: Number(req.params.id), hard: true });
      });
      return;
    }
    dbModule.db.run(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Introuvable' });
      res.json({ ok: true, id: Number(req.params.id) });
    });
  })
});

// Ajoute ce bloc après la création de la table app_config (dans la partie db.serialize)
(async () => {
  try {
    const cols = await listTableColumns('app_config');
    if (!Array.isArray(cols) || cols.includes('is_active')) return;
    if (isPostgres) {
      await dbModule.run(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 0;`);
    } else {
      dbModule.db.run(`ALTER TABLE app_config ADD COLUMN is_active INTEGER DEFAULT 0;`);
    }
  } catch (e) {
    console.warn('[server] app_config is_active migration ignorée:', e && e.message);
  }
})();

// Minimal dashboard fallbacks (guarantee endpoints exist)
app.get('/api/dashboard/armes', authMW, (req, res) => {
  dbModule.db.get(`SELECT COUNT(*) AS total FROM armes WHERE deleted_at IS NULL`, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ total: row?.total || 0 })
  })
})

app.get('/api/dashboard/dotations', authMW, (req, res) => {
  dbModule.db.get(`SELECT COUNT(*) AS total FROM dotations WHERE deleted_at IS NULL`, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ total: row?.total || 0 })
  })
})

app.get('/api/dashboard/vdp', authMW, (req, res) => {
  dbModule.db.get(`SELECT COUNT(*) AS total FROM vdp WHERE deleted_at IS NULL`, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ total: row?.total || 0 })
  })
})

const NO_COLUMN_REGEX = /no such column|table.*has no column|column\s+"?[a-z0-9_]+"?\s+does not exist/i

function respondCount(res, table, includeDeleted = false) {
  const physical = resolveTable(table);
  const clause = includeDeleted ? '' : ' WHERE deleted_at IS NULL';
  dbModule.db.get(`SELECT COUNT(*) AS total FROM ${physical}${clause}`, [], (err, row) => {
    if (err && NO_COLUMN_REGEX.test(err.message)) {
      return dbModule.db.get(`SELECT COUNT(*) AS total FROM ${physical}`, [], (err2, row2) => {
        if (err2) return res.status(500).json({ error: 'Erreur BD', detail: err2.message })
        res.json({ total: row2?.total || 0 })
      })
    }
    if (err)  return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json({ total: row?.total || 0 })
  })
}

function respondAllWithFallback(res, sql, fallbackSql, params = []) {
  dbModule.db.all(sql, params, (err, rows) => {
    if (err && NO_COLUMN_REGEX.test(err.message)) {
      if (!fallbackSql) return res.json([])
      return dbModule.db.all(fallbackSql, params, (err2, rows2) => {
        if (err2) return res.status(500).json({ error: 'Erreur BD', detail: err2.message })
        res.json(rows2 || [])
      })
    }
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json(rows || [])
  })
}

function respondRecentActivities(res, limit = 20) {
  const sql = `
    SELECT id,
           action,
           COALESCE(table_name, resource) AS "table",
           COALESCE(timestamp, created_at, date_action, updated_at) AS timestamp
    FROM audit_logs
    ORDER BY COALESCE(timestamp, created_at, date_action, updated_at) DESC
    LIMIT ?
  `
  dbModule.db.all(sql, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message })
    res.json(rows || [])
  })
}

// If no custom dashboard router provided, register endpoints mapped to DB schema
if (!tryRequire('./routes/dashboard')) {
  app.get('/api/dashboard/armes/by-type', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(c.type,'Inconnu') AS type, COUNT(a.id) AS total
        FROM armes a
        LEFT JOIN config_arme c ON c.id = a.config_arme_id
        WHERE a.deleted_at IS NULL
        GROUP BY c.type
        ORDER BY type
      `,
      `SELECT 'Toutes' AS type, COUNT(a.id) AS total FROM armes a GROUP BY 1`
    )
  )

  app.get('/api/dashboard/armes/by-category', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(cat.nom,'Inconnu') AS category, COUNT(a.id) AS total
        FROM armes a
        LEFT JOIN modeles_arme m ON m.id = a.modele_id
        LEFT JOIN categories_arme cat ON cat.id = m.categorie_id
        WHERE a.deleted_at IS NULL
        GROUP BY category
        ORDER BY total DESC
      `,
      `SELECT 'Toutes' AS category, COUNT(a.id) AS total FROM armes a GROUP BY 1`
    )
  )

  app.get('/api/dashboard/armes/by-status', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(a.etat,'Inconnu') AS status, COUNT(*) AS total
        FROM armes a
        WHERE a.deleted_at IS NULL
        GROUP BY a.etat
        ORDER BY status
      `,
      `SELECT 'Inconnu' AS status, COUNT(*) AS total FROM armes GROUP BY 1`
    )
  )

  app.get('/api/dashboard/armes/timeseries', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT DATE(updated_at) AS date, COUNT(*) AS total
        FROM armes
        WHERE deleted_at IS NULL
        GROUP BY DATE(updated_at)
        ORDER BY DATE(updated_at)
      `,
      `SELECT 'Total' AS date, COUNT(*) AS total FROM armes GROUP BY 1`
    )
  )

  // Munitions
  app.get('/api/dashboard/munitions/by-type', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(cm.designation,'Inconnu') AS type, COUNT(m.id) AS total
        FROM munitions m
        LEFT JOIN config_munition cm ON cm.id = m.config_munition_id
        WHERE m.deleted_at IS NULL
        GROUP BY cm.designation
        ORDER BY type
      `,
      `SELECT 'Toutes' AS type, COUNT(*) AS total FROM munitions GROUP BY 1`
    )
  )

  app.get('/api/dashboard/munitions/timeseries', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT DATE(updated_at) AS date, COUNT(*) AS total
        FROM munitions
        WHERE deleted_at IS NULL
        GROUP BY DATE(updated_at)
        ORDER BY DATE(updated_at)
      `,
      `SELECT 'Total' AS date, COUNT(*) AS total FROM munitions GROUP BY 1`
    )
  )

  // Materiel
  app.get('/api/dashboard/materiel/by-type', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(cm.designation,'Inconnu') AS type, COUNT(ms.id) AS total
        FROM materiels_specifiques ms
        LEFT JOIN config_materiel cm ON cm.id = ms.config_materiel_id
        WHERE ms.deleted_at IS NULL
        GROUP BY cm.designation
        ORDER BY type
      `,
      `SELECT 'Toutes' AS type, COUNT(*) AS total FROM materiels_specifiques GROUP BY 1`
    )
  )

  app.get('/api/dashboard/materiel/timeseries', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT DATE(updated_at) AS date, COUNT(*) AS total
        FROM materiels_specifiques
        WHERE deleted_at IS NULL
        GROUP BY DATE(updated_at)
        ORDER BY DATE(updated_at)
      `,
      `SELECT 'Total' AS date, COUNT(*) AS total FROM materiels_specifiques GROUP BY 1`
    )
  )

  // Dotations
  app.get('/api/dashboard/dotations/by-resource', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT COALESCE(NULLIF(resource_type,''), NULLIF(ressource_type,''), 'Inconnu') AS resource, COUNT(*) AS total
        FROM dotations
        WHERE deleted_at IS NULL
        GROUP BY resource
        ORDER BY resource
      `,
      `SELECT 'Toutes' AS resource, COUNT(*) AS total FROM dotations GROUP BY 1`
    )
  )

  app.get('/api/dashboard/dotations/timeseries', authMW, permissionGuard('dashboard_view'), (req, res) =>
    respondAllWithFallback(
      res,
      `
        SELECT DATE(date_dotation) AS date, COUNT(*) AS total
        FROM dotations
        WHERE deleted_at IS NULL
        GROUP BY DATE(date_dotation)
        ORDER BY DATE(date_dotation)
      `,
      `SELECT 'Total' AS date, COUNT(*) AS total FROM dotations GROUP BY 1`
    )
  )
}

// === DÉPLACER CES ROUTES ICI, AVANT le bloc "if (!tryRequire('./routes/dashboard'))" ===

// GET /api/armes/check?numero_serie=SN123 - Vérification doublon arme
app.get('/api/armes/check', authMW, (req, res) => {
  const sn = req.query.numero_serie;
  if (!sn) return res.status(400).json({ error: 'numero_serie requis' });
  const scopeWhere = buildScopeWhereClause('armes', req.scope || {});
  let query = `SELECT id, numero_serie, source_arme_id, designation, created_at FROM armes WHERE LOWER(numero_serie) = LOWER(?) AND deleted_at IS NULL`;
  const params = [sn];
  if (scopeWhere.clause) {
    query += ` AND ${scopeWhere.clause}`;
    params.push(...scopeWhere.params);
  }
  query += ' LIMIT 1';
  dbModule.db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    res.json(row || null);
  });
});

// GET /api/optiques/check?numero_serie=OPT123 - Vérification doublon optique
app.get('/api/optiques/check', authMW, (req, res) => {
  const sn = req.query.numero_serie;
  if (!sn) return res.status(400).json({ error: 'numero_serie requis' });
  const scopeWhere = buildScopeWhereClause('optiques', req.scope || {});
  let query = `SELECT id, numero_serie, designation, created_at FROM optiques WHERE LOWER(numero_serie) = LOWER(?) AND deleted_at IS NULL`;
  const params = [sn];
  if (scopeWhere.clause) {
    query += ` AND ${scopeWhere.clause}`;
    params.push(...scopeWhere.params);
  }
  query += ' LIMIT 1';
  dbModule.db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    res.json(row || null);
  });
});

// VDP endpoints
app.get('/api/dashboard/vdp/by-gender', authMW, permissionGuard('dashboard_view'), (req, res) =>
  respondAllWithFallback(
    res,
    `SELECT COALESCE(sexe,'Inconnu') AS gender, COUNT(*) AS total FROM vdp WHERE deleted_at IS NULL GROUP BY sexe ORDER BY gender`,
    `SELECT 'Inconnu' AS gender, COUNT(*) AS total FROM vdp GROUP BY 1`
  )
);

app.get('/api/dashboard/vdp/by-age-group', authMW, permissionGuard('dashboard_view'), (req, res) =>
  respondAllWithFallback(
    res,
    `SELECT CASE WHEN date_naissance IS NULL THEN 'Inconnu' WHEN (CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', date_naissance) AS INTEGER)) < 18 THEN '<18' WHEN (CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', date_naissance) AS INTEGER)) BETWEEN 18 AND 24 THEN '18-24' WHEN (CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', date_naissance) AS INTEGER)) BETWEEN 25 AND 34 THEN '25-34' WHEN (CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', date_naissance) AS INTEGER)) BETWEEN 35 AND 49 THEN '35-49' ELSE '50+' END AS age_group, COUNT(id) AS total FROM vdp WHERE deleted_at IS NULL GROUP BY age_group`,
    `SELECT 'Inconnu' AS age_group, COUNT(id) AS total FROM vdp GROUP BY 1`
  )
);

app.get('/api/dashboard/vdp/by-entity', authMW, permissionGuard('dashboard_view'), (req, res) =>
  respondAllWithFallback(
    res,
    `SELECT COALESCE(e.nom,'Inconnu') AS entity, COUNT(v.id) AS total FROM vdp v LEFT JOIN entites e ON e.id = v.entite_id WHERE v.deleted_at IS NULL GROUP BY e.nom ORDER BY entity`,
    `SELECT 'Inconnu' AS entity, COUNT(*) AS total FROM vdp GROUP BY 1`
  )
);

app.get('/api/dashboard/recent-activities', authMW, permissionGuard('dashboard_view'), (_req, res) =>
  respondRecentActivities(res, 20)
);

// Routes sources_armes
app.get('/api/sources_armes', authMW, permissionGuard('sources_armes_read'), (req, res) => {
  const includeDeleted = parseBool(req.query?.includeDeleted);
  const where = includeDeleted ? '' : ' WHERE deleted_at IS NULL';
  dbModule.db.all(`SELECT * FROM sources_armes${where} ORDER BY nom`, [], (err, rows) => {
    if (err) {
      console.error('[sources_armes] Erreur SELECT:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
    res.json(rows || []);
  });
});

app.get('/api/sources_armes/:id', authMW, permissionGuard('sources_armes_read'), (req, res) => {
  dbModule.db.get('SELECT * FROM sources_armes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('[sources_armes] Erreur SELECT by ID:', err.message);
      return res.status(500).json({ error: 'Erreur BD', detail: err.message });
    }
    if (!row) return res.status(404).json({ error: 'Source non trouvée' });
    res.json(row);
  });
});

app.post('/api/sources_armes', authMW, permissionGuard('sources_armes_create'), express.json(), (req, res) => {
  const payload = req.body || {};
  const { nom, code, description, provenance, source_dotation_id, date_reception, date_cloture } = payload;
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });
  
  dbModule.db.run(
    `INSERT INTO sources_armes (nom, code, description, provenance, source_dotation_id, date_reception, date_cloture) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nom, code || null, description || null, provenance || null, source_dotation_id || null, date_reception || null, date_cloture || null],
    function(err) {
      if (err) {
        console.error('[sources_armes] Erreur INSERT:', err.message);
        return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      }
      dbModule.db.get('SELECT * FROM sources_armes WHERE id = ?', [this.lastID], (selectErr, row) => {
        if (selectErr) return res.status(500).json({ error: 'Erreur BD', detail: selectErr.message });
        res.status(201).json(row);
      });
    }
  );
});

app.put('/api/sources_armes/:id', authMW, permissionGuard('sources_armes_update'), express.json(), (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const { nom, code, description, provenance, source_dotation_id, date_reception, date_cloture } = payload;
  
  dbModule.db.run(
    `UPDATE sources_armes SET nom = ?, code = ?, description = ?, provenance = ?, source_dotation_id = ?, date_reception = ?, date_cloture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [nom, code || null, description || null, provenance || null, source_dotation_id || null, date_reception || null, date_cloture || null, id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Source non trouvée' });
      dbModule.db.get('SELECT * FROM sources_armes WHERE id = ?', [id], (selectErr, row) => {
        if (selectErr) return res.status(500).json({ error: 'Erreur BD', detail: selectErr.message });
        res.json(row);
      });
    }
  );
});

app.delete('/api/sources_armes/:id', authMW, permissionGuard('sources_armes_delete'), (req, res) => {
  const id = req.params.id;
  const hard = parseBool(req.query?.hard);
  
  if (hard) {
    dbModule.db.run('DELETE FROM sources_armes WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Source non trouvée' });
      res.json({ ok: true, id: Number(id), hard: true });
    });
  } else {
    dbModule.db.run('UPDATE sources_armes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Source non trouvée' });
      res.json({ ok: true, id: Number(id) });
    });
  }
});

// Reintegrate arme
app.post('/api/armes/:id/reintegrate', authMW, (req, res) => {
  const id = req.params.id;
  dbModule.db.run(
    `UPDATE armes SET statut='non dotée', position='MAGASIN', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erreur BD', detail: err.message });
      res.json({ ok: true });
    }
  );
});

// POST armes avec vérification doublon
app.post('/api/armes', authMW, permissionGuard('armes_create'), express.json(), async (req, res) => {
  const table = 'armes';
  let payload = req.body || {};
  const originalPayload = { ...payload };
  const allowDuplicate =
    parseBool(originalPayload.forceDuplicate) ||
    parseBool(originalPayload.force_duplicate) ||
    parseBool(req.query?.forceDuplicate) ||
    parseBool(req.query?.force_duplicate);

  if (!('position' in payload)) payload.position = "";
  if (!('mobilite' in payload)) payload.mobilite = "normale";
  if ('position_id' in payload) delete payload.position_id;

  const insertArme = () => {
    listTableColumns(table)
      .then((validCols) => {
        if (!Array.isArray(validCols)) validCols = [];
        const filteredPayload = Object.fromEntries(
          Object.entries(payload).filter(([k]) => validCols.includes(k))
        );
      const cols = Object.keys(filteredPayload);
      const values = cols.map(k => filteredPayload[k]);
      if (!cols.length) return res.status(400).json({ error: 'Aucune donnée fournie' });

      const placeholders = cols.map(() => '?').join(',');
      const insertQuery = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;

      dbModule.db.run(insertQuery, values, function(insertErr) {
        if (insertErr) {
          console.error(`[armes] Erreur INSERT:`, insertErr.message);
          return res.status(500).json({ error: 'Erreur BD', detail: insertErr.message });
        }
        dbModule.db.get(`SELECT * FROM ${table} WHERE id = ?`, [this.lastID], (selectErr, row) => {
          if (selectErr) return res.status(500).json({ error: 'Erreur BD', detail: selectErr.message });
          if (!row) return res.status(500).json({ error: 'Enregistrement introuvable après création.' });
          res.status(201).json(row);
        });
      });
      })
      .catch((err) => {
        console.error('[armes] listTableColumns error:', err && err.message);
        return res.status(500).json({ error: 'Erreur BD', detail: err?.message || 'Erreur introspection table' });
      });
  };

  const { numero_serie } = payload;
  if (numero_serie && !allowDuplicate) {
    dbModule.db.get(
      `SELECT id FROM armes WHERE LOWER(numero_serie) = LOWER(?) AND deleted_at IS NULL LIMIT 1`,
      [numero_serie],
      (err, row) => {
        if (err) {
          console.error('[armes] Erreur vérification doublon:', err.message);
          return res.status(500).json({ error: 'Erreur BD', detail: err.message });
        }
        if (row) {
          return res.status(400).json({
            error: 'Doublon',
            detail: 'Une arme existe déjà avec ce numéro de série.',
            existingId: row.id
          });
        }
        insertArme();
      }
    );
  } else {
    insertArme();
  }
});

function listRoutes() {
  try {
    console.log('--- Mounted routes ---');
  } catch (err) {
    console.error('Error listing routes:', err);
  }
}

async function start(options = {}) {
  // Compat: start(3001) et start({ port: 3001, host: '127.0.0.1' })
  const normalizedOptions =
    typeof options === 'number'
      ? { port: options }
      : (options && typeof options === 'object' ? options : {});

  const host = normalizedOptions.host ?? process.env.API_HOST ?? API_HOST;
  const portRaw = normalizedOptions.port ?? process.env.API_PORT ?? API_PORT;
  const port = Number(portRaw);
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, host, () => {
      console.log(`[server] API démarrée sur http://${host}:${port}`);
      resolve(srv);
    });
    srv.once('error', err => {
      reject(err);
    });
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('[server] Démarrage impossible :', err && err.stack || err);
    process.exit(1);
  });
}

module.exports = { app, start, EXPORT_TABLES, IMPORT_ORDER };
