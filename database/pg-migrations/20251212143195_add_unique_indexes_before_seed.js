/* Migration: add unique indexes required for ON CONFLICT upserts
   This migration is placed just before the seed migration so INSERT ... ON CONFLICT
   statements in the seed have the necessary unique constraints/indexes to target. */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createIndex('types_arme', 'nom', { unique: true, ifNotExists: true });
  pgm.createIndex('categories_arme', ['type_id', 'nom'], { unique: true, ifNotExists: true });
  pgm.createIndex('roles', 'nom', { unique: true, ifNotExists: true });
  pgm.createIndex('utilisateurs', 'username', { unique: true, ifNotExists: true });
  pgm.createIndex('sources_dotation', 'nom', { unique: true, ifNotExists: true });
  pgm.createIndex('user_roles', ['user_id', 'role_id'], { unique: true, ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropIndex('types_arme', 'nom', { ifExists: true });
  pgm.dropIndex('categories_arme', ['type_id', 'nom'], { ifExists: true });
  pgm.dropIndex('roles', 'nom', { ifExists: true });
  pgm.dropIndex('utilisateurs', 'username', { ifExists: true });
  pgm.dropIndex('sources_dotation', 'nom', { ifExists: true });
  pgm.dropIndex('user_roles', ['user_id', 'role_id'], { ifExists: true });
};
