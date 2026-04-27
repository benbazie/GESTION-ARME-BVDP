'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Charge .env / .env.local (utile en CLI, migrations, scripts)
[
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
].forEach((candidate) => {
  try {
    if (candidate && fs.existsSync(candidate)) dotenv.config({ path: candidate });
  } catch (_) {}
});

const ensureNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveSslOption = () => {
  const raw = process.env.PG_SSL;
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return { rejectUnauthorized: false };
  if (normalized === 'require') return { rejectUnauthorized: true };
  if (normalized === 'false' || normalized === '0') return false;
  return raw;
};

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: ensureNumber(process.env.PG_PORT, 5432),
  database: process.env.PG_DATABASE || 'gestion_armes_vdp',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  ssl: resolveSslOption(),
});

// Convertit les placeholders (?) en placeholders PostgreSQL ($1, $2...)
function convertPlaceholders(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  let idx = 0;
  let out = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && !inDouble) {
      const prev = sql[i - 1];
      if (prev !== '\\') inSingle = !inSingle;
      out += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      const prev = sql[i - 1];
      if (prev !== '\\') inDouble = !inDouble;
      out += ch;
      continue;
    }

    if (ch === '?' && !inSingle && !inDouble) {
      idx += 1;
      out += `$${idx}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function normalizeSql(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  let out = sql;

  // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
  out = out.replace(/\bINSERT\s+OR\s+IGNORE\b/ig, 'INSERT');
  if (/\bINSERT\b/i.test(out) && /\bOR\s+IGNORE\b/i.test(sql)) {
    if (!/\bON\s+CONFLICT\b/i.test(out)) {
      out = `${out.trim().replace(/;\s*$/, '')} ON CONFLICT DO NOTHING`;
    }
  }

  // GROUP_CONCAT -> STRING_AGG
  out = out.replace(/GROUP_CONCAT\(\s*DISTINCT\s+([^\)]+)\)/ig, 'STRING_AGG(DISTINCT $1, ",")');
  out = out.replace(/GROUP_CONCAT\(\s*([^\)]+)\)/ig, 'STRING_AGG($1, ",")');

  return out;
}

function ensureReturningId(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (!/^INSERT\b/i.test(trimmed)) return sql;
  if (/\bRETURNING\b/i.test(trimmed)) return sql;
  return `${trimmed} RETURNING id`;
}

async function query(sql, params = []) {
  const normalized = normalizeSql(sql);
  const converted = convertPlaceholders(normalized);
  if (process.env.DEBUG_SQL === 'true') {
    try {
      console.log('[pg] SQL ->', converted, Array.isArray(params) ? params : []);
    } catch (_) {}
  }
  try {
    return await pool.query(converted, params);
  } catch (err) {
    try {
      console.error('[pg] SQL ERROR ->', converted, Array.isArray(params) ? params : [], '|', err && err.message);
    } catch (_) {}
    throw err;
  }
}

async function all(sql, params = []) {
  const res = await query(sql, params);
  return res.rows || [];
}

async function get(sql, params = []) {
  if (!sql || typeof sql !== 'string') {
    const rows = await all(sql, params);
    return rows[0] || undefined;
  }

  const trimmed = sql.trim().replace(/;\s*$/, '');
  const startsLikeSelect = /^\s*(WITH\b|SELECT\b)/i.test(trimmed);
  const alreadyLimited = /\bLIMIT\b/i.test(trimmed) || /\bFETCH\s+FIRST\b/i.test(trimmed);
  const effectiveSql = startsLikeSelect && !alreadyLimited ? `${trimmed} LIMIT 1` : trimmed;

  const rows = await all(effectiveSql, params);
  return rows[0] || undefined;
}

async function run(sql, params = []) {
  const normalized = normalizeSql(sql);
  const withReturning = ensureReturningId(normalized);
  const converted = convertPlaceholders(withReturning);

  const res = await pool.query(converted, params);
  const lastID = res?.rows?.[0]?.id;
  return {
    lastID,
    changes: typeof res?.rowCount === 'number' ? res.rowCount : 0,
    rowCount: res?.rowCount,
    rows: res?.rows || [],
  };
}

// --- Compat callbacks (API historique type sqlite3) ---
function splitParamsAndCb(params) {
  if (typeof params === 'function') return { params: [], cb: params };
  if (Array.isArray(params)) return { params, cb: null };
  return { params: params ?? [], cb: null };
}

function withOptionalCallback(promiseFactory, paramsOrCb, maybeCb) {
  const { params, cb } = splitParamsAndCb(paramsOrCb);
  const callback = typeof maybeCb === 'function' ? maybeCb : cb;
  if (callback) {
    Promise.resolve()
      .then(() => promiseFactory(params))
      .then((result) => callback(null, result))
      .catch((err) => callback(err));
    return undefined;
  }
  return promiseFactory(params);
}

function allCb(sql, paramsOrCb, maybeCb) {
  return withOptionalCallback((params) => all(sql, params), paramsOrCb, maybeCb);
}

function getCb(sql, paramsOrCb, maybeCb) {
  return withOptionalCallback((params) => get(sql, params), paramsOrCb, maybeCb);
}

function runCb(sql, paramsOrCb, maybeCb) {
  const { params, cb } = splitParamsAndCb(paramsOrCb);
  const callback = typeof maybeCb === 'function' ? maybeCb : cb;
  if (callback) {
    Promise.resolve()
      .then(() => run(sql, params))
      .then((result) => {
        // sqlite3-like behaviour: callback(err) with Statement context
        // where `this.lastID` and `this.changes` are populated.
        const ctx = {
          lastID: result?.lastID,
          changes: typeof result?.changes === 'number' ? result.changes : 0,
        };
        callback.call(ctx, null, result);
      })
      .catch((err) => callback(err));
    return undefined;
  }
  return run(sql, params);
}

class PreparedStatement {
  constructor(sql) {
    this.sql = sql;
  }

  async run(params = []) {
    return run(this.sql, params);
  }

  async finalize() {
    // no-op pour Postgres
  }
}

async function prepare(sql) {
  return new PreparedStatement(sql);
}

async function close() {
  await pool.end();
}

// Compat API legacy (no-op)
function serialize(fn) {
  return fn ? fn() : undefined;
}
function parallelize(fn) {
  return fn ? fn() : undefined;
}

async function tableExists(tableName) {
  const sql = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ?
    LIMIT 1
  `;
  const row = await get(sql, [tableName]);
  return !!row;
}

async function listTableColumns(tableName) {
  const sql = `
    SELECT column_name AS name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ?
    ORDER BY ordinal_position
  `;
  const rows = await all(sql, [tableName]);
  return rows.map(r => r.name).filter(Boolean);
}

const client = {
  client: 'pg',
  pool,
  db: { all: allCb, get: getCb, run: runCb, prepare, close, serialize, parallelize },
  query,
  all: allCb,
  get: getCb,
  run: runCb,
  prepare,
  close,
  serialize,
  parallelize,
  tableExists,
  listTableColumns,
};

module.exports = client;
module.exports.default = client;
