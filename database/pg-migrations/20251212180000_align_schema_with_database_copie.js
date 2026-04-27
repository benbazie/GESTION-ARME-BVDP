'use strict';

const fs = require('fs');
const path = require('path');

const readSql = (relativePath) => {
  const abs = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(abs, 'utf8');
};

exports.up = (pgm) => {
  const sql = readSql('schema.database-copie.pg.sql');
  pgm.sql(sql);
};

exports.down = (_pgm) => {
  // Migration volontairement non destructive.
  // Si besoin, repartir d'une base neuve et réimporter les données.
};
