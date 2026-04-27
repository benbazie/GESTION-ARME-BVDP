'use strict';

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS roles TEXT NOT NULL DEFAULT '[]';");
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE utilisateurs DROP COLUMN IF EXISTS roles;');
};
