'use strict';

exports.up = (pgm) => {
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN prenom DROP NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN nom    DROP NOT NULL');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN prenom SET NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN nom    SET NOT NULL');
};
