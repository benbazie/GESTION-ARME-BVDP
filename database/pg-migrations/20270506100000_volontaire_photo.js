'use strict';

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE sync_checkpoint
      ADD COLUMN IF NOT EXISTS last_cursor TEXT;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS volontaire_photo (
      id_volontaire  BIGINT       PRIMARY KEY,
      photo          BYTEA        NOT NULL,
      etag           TEXT         NOT NULL,
      last_modified  TIMESTAMPTZ  NOT NULL,
      size_bytes     INTEGER      NOT NULL,
      created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_volontaire_photo_etag ON volontaire_photo(etag);`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS volontaire_photo;`);
  pgm.sql(`ALTER TABLE sync_checkpoint DROP COLUMN IF EXISTS last_cursor;`);
};
