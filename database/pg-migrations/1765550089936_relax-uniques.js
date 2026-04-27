/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
	pgm.sql('ALTER TABLE IF EXISTS categories_arme DROP CONSTRAINT IF EXISTS categories_arme_type_id_nom_key');
	pgm.sql('ALTER TABLE IF EXISTS modeles_arme DROP CONSTRAINT IF EXISTS modeles_arme_categorie_id_nom_key');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
	pgm.sql('ALTER TABLE IF EXISTS categories_arme ADD CONSTRAINT categories_arme_type_id_nom_key UNIQUE (type_id, nom)');
	pgm.sql('ALTER TABLE IF EXISTS modeles_arme ADD CONSTRAINT modeles_arme_categorie_id_nom_key UNIQUE (categorie_id, nom)');
};
