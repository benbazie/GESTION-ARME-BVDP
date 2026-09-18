'use strict';

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE armes
      ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'les_deux';
  `);
  // Valeurs valides : 'individuel' | 'collectif' | 'les_deux'
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE armes DROP COLUMN IF EXISTS usage_type;`);
};
