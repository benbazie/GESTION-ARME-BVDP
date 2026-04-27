const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '.env.local'),
  path.resolve(__dirname, 'config', '.env'),
  path.resolve(__dirname, 'config', '.env.local')
];

envCandidates.forEach((candidate) => {
  try {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: true });
    }
  } catch (err) {
    console.warn('[pg-migrate] Impossible de charger', candidate, err.message);
  }
});

const resolveSslOption = () => {
  const raw = process.env.PG_SSL;
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return { rejectUnauthorized: false };
  if (normalized === 'require') return { rejectUnauthorized: true };
  if (normalized === 'false' || normalized === '0') return false;
  return raw;
};

const ensureNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildDatabaseUrl = () => {
  const host = process.env.PG_HOST || 'localhost';
  const port = ensureNumber(process.env.PG_PORT, 5432);
  const database = process.env.PG_DATABASE || 'gestion_armes_vdp';
  const user = process.env.PG_USER || 'postgres';
  const password = process.env.PG_PASSWORD || 'postgres';

  const enc = encodeURIComponent;
  return `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${enc(database)}`;
};

// node-pg-migrate CLI lit un "config-file" au format d'options CLI (kebab-case)
// et/ou un champ "url" (connection string). On fournit donc "url" pour éviter
// de dépendre des variables PGPASSWORD/PGUSER/PGDATABASE utilisées par pg.
module.exports = {
  url: buildDatabaseUrl(),
  'migrations-dir': path.resolve(__dirname, 'database', 'pg-migrations'),
  'migrations-table': process.env.PG_MIGRATIONS_TABLE || 'pgmigrations',
  'check-order': false,
  'migration-file-language': 'js',
  verbose: process.env.PG_MIGRATE_DEBUG === 'true',
  // L'option SSL de node-pg-migrate se configure via la connection string.
  // On garde PG_SSL pour l'app runtime; pour les migrations, l'URL suffit.
  // Si besoin, on pourra ajouter "reject-unauthorized" côté CLI.
};
