'use strict';

require('dotenv').config();

const dbMod = require('../database/database');

// Tables attendues d'après `database/database - Copie.js` (référence SQLite).
// NB: la référence contient aussi d'autres tables dans le projet (audit_logs, sync_logs, etc.),
// mais ici on compare le coeur explicitement défini/seedé dans ce script.
const EXPECTED_TABLES = [
  // localisation
  'regions',
  'provinces',
  'communes',
  'localites',

  // organisation
  'entites',
  'sous_entites',

  // coordinations hiérarchiques
  'coordination_regionale',
  'coordination_provinciale',
  'coordination_communale',
  'localite_coordination',

  // vdp
  'vdp',

  // référentiels armes
  'types_arme',
  'categories_arme',
  'modeles_arme',

  // configurations / ressources
  'config_arme',
  'config_optique',
  'config_materiel',
  'sources_dotation',
  'sources_armes',
  'armes',
  'optiques',
  'materiels_specifiques',

  // dotations (modèle items)
  'dotations',
  'dotation_items',

  // auth / roles
  'roles',
  'utilisateurs',
  'user_roles',
  'sessions',
  'notifications',
  'app_config',
];

const REQUIRED_COLUMNS = {
  // geo lat/long
  regions: ['latitude', 'longitude'],
  provinces: ['latitude', 'longitude'],
  communes: ['latitude', 'longitude'],
  localites: ['latitude', 'longitude'],

  // vdp hiérarchie
  vdp: [
    'coordination_regionale_id',
    'coordination_provinciale_id',
    'coordination_communale_id',
    'region_id',
    'province_id',
    'commune_id',
    'localite_id',
  ],

  // armes enrichies (extraits clés)
  armes: [
    'source_arme_id',
    'ownership_type',
    'coordination_regionale_id',
    'coordination_provinciale_id',
    'coordination_communale_id',
    'created_by',
    'created_by_name',
    'updated_by',
    'updated_by_name',
    'deleted_by',
    'deleted_by_name',
    'deleted',
  ],

  // utilisateurs profil
  utilisateurs: ['nom', 'prenom', 'grade', 'contact', 'email'],
};

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbMod.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function listPublicTables() {
  const rows = await all(
    "SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename",
    []
  );
  return rows.map((r) => r.name);
}

async function listColumns(table) {
  const rows = await all(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name = ? ORDER BY ordinal_position",
    [table]
  );
  return rows.map((r) => r.name);
}

(async () => {
  try {
    const expectedSet = new Set(EXPECTED_TABLES);
    const actualTables = await listPublicTables();
    const actualSet = new Set(actualTables);

    const missingTables = EXPECTED_TABLES.filter((t) => !actualSet.has(t));
    const extraTables = actualTables.filter((t) => !expectedSet.has(t));

    console.log('=== DIFF SCHÉMA (Postgres vs database - Copie.js) ===');
    console.log('\n--- Tables attendues manquantes ---');
    console.log(missingTables.length ? missingTables.join(', ') : '(aucune)');

    console.log('\n--- Tables présentes en plus (hors référence SQLite) ---');
    console.log(extraTables.length ? extraTables.join(', ') : '(aucune)');

    console.log('\n--- Colonnes attendues manquantes (extraits clés) ---');
    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
      if (!actualSet.has(table)) {
        console.log(`${table}: (table absente)`);
        continue;
      }
      const cols = await listColumns(table);
      const colSet = new Set(cols);
      const missing = required.filter((c) => !colSet.has(c));
      if (missing.length) console.log(`${table}: ${missing.join(', ')}`);
    }

    console.log('\n--- Notes ---');
    console.log(
      "- Les tables en 'plus' ne sont pas forcément mauvaises (audit_logs, sync_logs, migrations, backups)."
    );
    console.log(
      "- Objectif: ajouter ce qui manque via migrations, sans supprimer tes données."
    );
  } catch (err) {
    console.error('Erreur diff:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try {
      await dbMod.close?.();
    } catch {}
  }
})();
