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
	pgm.sql('ALTER TABLE IF EXISTS dotations ALTER COLUMN ressource_type DROP NOT NULL');
	pgm.sql('ALTER TABLE IF EXISTS dotations ALTER COLUMN ressource_id DROP NOT NULL');
	pgm.sql('ALTER TABLE IF EXISTS dotations ALTER COLUMN type_dotation DROP NOT NULL');

	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS code TEXT');
	pgm.sql("ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS dotation_type TEXT DEFAULT 'individuelle'");
	pgm.sql("ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS beneficiary_type TEXT DEFAULT 'vdp'");
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS sous_entite_id INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS coordination_id INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS lot_id INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS source_id INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS date_prevue_retour DATE');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS date_cloture DATE');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS created_by INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS updated_by INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS deleted_by INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS source_arme_id INTEGER');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ');
	pgm.sql('ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ');

	pgm.sql(`
		CREATE TABLE IF NOT EXISTS dotation_items (
			id SERIAL PRIMARY KEY,
			dotation_id INTEGER NOT NULL,
			resource_type TEXT,
			resource_id INTEGER,
			quantite INTEGER DEFAULT 1,
			status TEXT,
			condition_initiale TEXT,
			condition_retour TEXT,
			returned_at TIMESTAMPTZ,
			returned_by INTEGER,
			created_by INTEGER,
			updated_by INTEGER,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			synced BOOLEAN DEFAULT FALSE,
			deleted_at TIMESTAMPTZ,
			source_arme_id INTEGER
		);
	`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
	pgm.sql('DROP TABLE IF EXISTS dotation_items');

	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS code');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS dotation_type');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS beneficiary_type');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS sous_entite_id');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS coordination_id');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS lot_id');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS source_id');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS date_prevue_retour');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS date_cloture');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS created_by');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS updated_by');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS deleted_by');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS source_arme_id');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS created_at');
	pgm.sql('ALTER TABLE IF EXISTS dotations DROP COLUMN IF EXISTS updated_at');
};
