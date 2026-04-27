'use strict';

const db = require('../database/database');

const sql = "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename";

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  const names = (rows || []).map((r) => r.tablename).filter(Boolean);
  process.stdout.write(names.join('\n'));
  process.stdout.write('\n');

  if (typeof db.close === 'function') {
    Promise.resolve(db.close()).catch(() => {}).finally(() => process.exit(0));
    return;
  }

  process.exit(0);
});
