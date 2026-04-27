'use strict';

exports.up = (pgm) => {
  const addHierarchy = (table) => {
    pgm.addColumn(
      table,
      {
        coordination_regionale_id: {
          type: 'integer',
          references: 'coordination_regionale',
          onDelete: 'set null',
          onUpdate: 'cascade',
          notNull: false,
        },
        coordination_provinciale_id: {
          type: 'integer',
          references: 'coordination_provinciale',
          onDelete: 'set null',
          onUpdate: 'cascade',
          notNull: false,
        },
        coordination_communale_id: {
          type: 'integer',
          references: 'coordination_communale',
          onDelete: 'set null',
          onUpdate: 'cascade',
          notNull: false,
        },
      },
      { ifNotExists: true }
    );

    pgm.createIndex(table, 'coordination_regionale_id', { ifNotExists: true });
    pgm.createIndex(table, 'coordination_provinciale_id', { ifNotExists: true });
    pgm.createIndex(table, 'coordination_communale_id', { ifNotExists: true });
  };

  // Alignement avec `database/database - Copie.js` (ensureCoordinationHierarchyColumns)
  addHierarchy('optiques');
  addHierarchy('materiels_specifiques');
  addHierarchy('munitions');
};

exports.down = (pgm) => {
  // Non destructif par défaut.
  // Si tu veux vraiment revenir en arrière, supprime les indexes/colonnes explicitement.
};
