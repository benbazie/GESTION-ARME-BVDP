'use strict';

exports.up = (pgm) => {
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN contact_urgence1    DROP NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN nom_personne_prevenir DROP NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN lien_personne_prevenir DROP NOT NULL');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN contact_urgence1    SET NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN nom_personne_prevenir SET NOT NULL');
  pgm.sql('ALTER TABLE IF EXISTS vdp ALTER COLUMN lien_personne_prevenir SET NOT NULL');
};
