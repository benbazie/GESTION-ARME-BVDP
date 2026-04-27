'use strict';

const db = require('../database/database');

const execAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const execGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const closeDb = async () => {
  if (typeof db.close === 'function') {
    try {
      await db.close();
    } catch (_) {}
  }
};

const pickSampleColumns = async (table) => {
  const cols = await execAll(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1 ORDER BY ordinal_position",
    [table]
  );
  const names = cols.map((c) => c.name).filter(Boolean);
  const preferred = [
    'id',
    'nom',
    'code',
    'username',
    'numero_serie',
    'type',
    'categorie',
    'created_at',
    'updated_at',
  ].filter((c) => names.includes(c));

  const chosen = Array.from(new Set([...preferred, ...names])).slice(0, 8);
  return chosen.length ? chosen : ['*'];
};

const main = async () => {
  const tables = await execAll(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const tableNames = tables.map((t) => t.tablename).filter(Boolean);

  console.log('=== Rapport migration PostgreSQL ===');
  console.log('Base :', process.env.PG_DATABASE || '(PG_DATABASE manquant)');
  console.log('Host :', process.env.PG_HOST || '(PG_HOST manquant)');
  console.log('Port :', process.env.PG_PORT || '(PG_PORT manquant)');
  console.log('Tables (public) :', tableNames.length);
  console.log('');

  // 1) Comptage lignes par table
  console.log('--- Comptage (COUNT(*)) ---');
  const counts = [];
  for (const table of tableNames) {
    try {
      const row = await execGet(`SELECT COUNT(*)::bigint AS count FROM ${table}`);
      const count = row ? Number(row.count) : 0;
      counts.push({ table, count });
    } catch (e) {
      counts.push({ table, error: e?.message || String(e) });
    }
  }
  for (const c of counts) {
    if (c.error) {
      console.log(`${c.table}: ERREUR (${c.error})`);
    } else {
      console.log(`${c.table}: ${c.count}`);
    }
  }

  // 2) Échantillon tables clés
  const sampleTables = [
    'utilisateurs',
    'roles',
    'user_roles',
    'regions',
    'provinces',
    'communes',
    'localites',
    'armes',
    'munitions',
    'optiques',
    'dotations',
  ].filter((t) => tableNames.includes(t));

  if (sampleTables.length) {
    console.log('');
    console.log('--- Échantillon (3 lignes) ---');
    for (const table of sampleTables) {
      const cols = await pickSampleColumns(table);
      const selectCols = cols[0] === '*' ? '*' : cols.map((c) => `"${c}"`).join(', ');
      const sql = `SELECT ${selectCols} FROM ${table} ORDER BY 1 NULLS LAST LIMIT 3`;
      try {
        const rows = await execAll(sql);
        console.log(`\n[${table}]`);
        console.log(JSON.stringify(rows, null, 2));
      } catch (e) {
        console.log(`\n[${table}] ERREUR:`, e?.message || String(e));
      }
    }
  }

  console.log('\n=== Fin rapport ===');
};

main()
  .then(closeDb)
  .catch(async (e) => {
    console.error(e?.stack || e?.message || e);
    await closeDb();
    process.exit(1);
  });
