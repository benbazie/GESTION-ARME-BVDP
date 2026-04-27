'use strict';

const fs = require('fs');
const path = require('path');

const readSql = (relativePath) => {
  const abs = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(abs, 'utf8');
};

exports.up = (pgm) => {
  const sql = readSql('schema.sql');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Down complet volontairement non fourni (schéma large).
  // Utiliser un reset de base en dev si nécessaire.
};
