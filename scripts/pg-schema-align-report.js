'use strict';

require('dotenv').config();

const db = require('../database/database');

const tablesToCheck = [
  'regions','provinces','communes','localites',
  'coordination_regionale','coordination_provinciale','coordination_communale','localite_coordination',
  'entites','sous_entites','coordinations',
  'vdp','armes','sources_armes','dotations','dotation_items','utilisateurs'
];

const requiredColumns = {
  regions: ['latitude','longitude'],
  provinces: ['latitude','longitude'],
  communes: ['latitude','longitude'],
  localites: ['latitude','longitude'],
  vdp: ['coordination_regionale_id','coordination_provinciale_id','coordination_communale_id'],
  armes: ['source_arme_id','ownership_type','coordination_regionale_id','coordination_provinciale_id','coordination_communale_id'],
  utilisateurs: ['nom','prenom','grade','contact','email']
};

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

(async () => {
  try {
    const missingTables = [];
    for (const t of tablesToCheck) {
      const rows = await all(
        "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name = ? LIMIT 1",
        [t]
      );
      if (!rows.length) missingTables.push(t);
    }

    console.log('--- Tables manquantes ---');
    console.log(missingTables.length ? missingTables.join(', ') : '(aucune)');

    console.log('\n--- Colonnes manquantes ---');
    for (const [table, cols] of Object.entries(requiredColumns)) {
      const found = await all(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ?",
        [table]
      );
      const set = new Set(found.map((r) => r.column_name));
      const missing = cols.filter((c) => !set.has(c));
      if (missing.length) console.log(`${table}: ${missing.join(', ')}`);
    }

    console.log('\nOK');
  } catch (err) {
    console.error('Erreur report:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try { await db.close?.(); } catch {}
  }
})();
