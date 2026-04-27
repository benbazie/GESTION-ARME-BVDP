'use strict';

const fs = require('fs');
const path = require('path');

const readSql = (relativePath) => {
  const abs = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(abs, 'utf8');
};

exports.up = (pgm) => {
  const sql = readSql('seed.sql');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Pas de down pour les seeds (idempotent via ON CONFLICT DO NOTHING).
};
