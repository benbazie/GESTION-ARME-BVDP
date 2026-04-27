'use strict';

exports.up = (pgm) => {
  // Alignement avec `database/database - Copie.js` et le front
  // (les formulaires envoient `entite_id` et les listes l'affichent).
  pgm.addColumn('coordination_regionale', {
    entite_id: {
      type: 'integer',
      references: 'entites',
      onDelete: 'set null',
      onUpdate: 'cascade',
      notNull: false,
    },
  }, { ifNotExists: true });

  // Index utile pour les filtres.
  pgm.createIndex('coordination_regionale', 'entite_id', { ifNotExists: true });
};

exports.down = (pgm) => {
  // Non destructif par défaut.
  // Si tu veux vraiment revenir en arrière:
  // pgm.dropIndex('coordination_regionale', 'entite_id');
  // pgm.dropColumn('coordination_regionale', 'entite_id');
};
