'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_CANDIDATES = [
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

ENV_CANDIDATES.forEach((candidate) => {
  try {
    if (candidate && fs.existsSync(candidate)) {
      const isLocal = /\.env\.local$/i.test(candidate);
      dotenv.config({ path: candidate, override: isLocal });
    }
  } catch (err) {
    console.warn('[database] Impossible de charger', candidate, err && err.message);
  }
});

const resolveClientName = () => {
  const explicit = process.env.DB_CLIENT || process.env.DATABASE_CLIENT || 'pg';
  return String(explicit).trim().toLowerCase();
};

const clientName = resolveClientName();
const pgAliases = new Set(['pg', 'postgres', 'postgresql']);
if (!pgAliases.has(clientName)) {
  throw new Error(
    `[database] Mode PostgreSQL requis. Configure DB_CLIENT=pg (valeur actuelle: ${clientName}).`
  );
}

const client = require('./postgres');

if (!client) {
  throw new Error(`[database] Client introuvable pour DB_CLIENT=${clientName}`);
}

if (!client?.db || typeof client.db.all !== 'function') {
  throw new Error('[database] Le client Postgres ne fournit pas db.{all,get,run,prepare}');
}

module.exports = client;
module.exports.default = client;
