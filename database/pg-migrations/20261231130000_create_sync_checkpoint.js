'use strict';

exports.up = (pgm) => {
  pgm.createTable(
    'sync_checkpoint',
    {
      id:         { type: 'serial', primaryKey: true },
      module:     { type: 'text', notNull: true, unique: true },
      last_page:  { type: 'integer', notNull: true, default: 0 },
      status:     { type: 'text', notNull: true, default: 'pending' },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    },
    { ifNotExists: true }
  );
};

exports.down = (pgm) => {
  pgm.dropTable('sync_checkpoint', { ifExists: true });
};
