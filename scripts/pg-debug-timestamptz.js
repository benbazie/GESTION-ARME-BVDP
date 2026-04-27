'use strict';

process.env.DEBUG_SQL = 'true';

const db = require('../database/postgres');

async function relationInfo(name) {
  const sql = `
    SELECT
      c.relname,
      c.relkind,
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'f' THEN 'foreign table'
        ELSE c.relkind::text
      END AS kind,
      n.nspname AS schema
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = $1
    LIMIT 1;
  `;
  const res = await db.query(sql, [name]);
  return res.rows[0] || null;
}

async function columnsInfo(table) {
  const sql = `
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position;
  `;
  const res = await db.query(sql, [table]);
  return res.rows;
}

async function tryQuery(label, sql) {
  try {
    const res = await db.query(sql);
    console.log(`\n[OK] ${label}`);
    console.log(res.rows);
  } catch (e) {
    console.log(`\n[ERR] ${label}`);
    console.log(String(e && e.message ? e.message : e));
  }
}

(async () => {
  const targets = ['regions', 'entites', 'sous_entites'];

  for (const t of targets) {
    console.log('\n====', t, '====');
    console.log('relation:', await relationInfo(t));
    const cols = await columnsInfo(t);
    const interesting = cols.filter(c => ['deleted_at', 'created_at', 'updated_at', 'date_action', 'timestamp'].includes(c.column_name));
    console.log('timestamp columns:', interesting);
  }

  await tryQuery('regions minimal', "SELECT * FROM regions WHERE deleted_at IS NULL LIMIT 1");
  await tryQuery('entites minimal', "SELECT * FROM entites WHERE deleted_at IS NULL LIMIT 1");
  await tryQuery('sous_entites minimal', "SELECT * FROM sous_entites WHERE deleted_at IS NULL LIMIT 1");

  await tryQuery('regions includeDeleted', "SELECT * FROM regions LIMIT 1");

  await db.close();
})().catch(async (e) => {
  console.error('fatal', e && e.stack ? e.stack : e);
  try { await db.close(); } catch (_) {}
  process.exit(1);
});
