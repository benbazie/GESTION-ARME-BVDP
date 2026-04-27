/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

const fs = require('fs');
const path = require('path');

const readSql = (relativePath) => {
	const sqlPath = path.resolve(__dirname, '..', relativePath);
	return fs.readFileSync(sqlPath, 'utf8');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
	pgm.sql(readSql('schema.sql'));
	pgm.sql(readSql('seed.sql'));
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
};
