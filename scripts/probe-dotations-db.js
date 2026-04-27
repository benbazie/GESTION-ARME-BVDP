'use strict';

const pg = require('../database/postgres');

async function main() {
  const tables = [
    'dotations',
    'dotation_items',
    'dotation_history',
    'lots',
    'sources_armes',
    'sources_dotation',
    'vdp',
    'entites',
    'armes',
    'optiques',
    'munitions',
    'materiels_specifiques',
  ];

  const exists = {};
  for (const table of tables) {
    const res = await pg.query(
      "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1",
      [table]
    );
    exists[table] = Array.isArray(res.rows) && res.rows.length > 0;
  }

  const counts = {};
  for (const table of tables) {
    if (!exists[table]) continue;
    const res = await pg.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    counts[table] = Array.isArray(res.rows) && res.rows.length ? res.rows[0].n : null;
  }

  const dotationsColumns = exists.dotations
    ? (
        await pg.query(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='dotations' ORDER BY ordinal_position"
        )
      ).rows
    : [];

  const dotationItemsColumns = exists.dotation_items
    ? (
        await pg.query(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='dotation_items' ORDER BY ordinal_position"
        )
      ).rows
    : [];

  console.log(
    JSON.stringify(
      {
        exists,
        counts,
        dotationsColumns,
        dotationItemsColumns,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error('PROBE_FAILED', err && err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pg.close();
    } catch (_) {}
  });
