'use strict';

/**
 * Crée les tables présentes dans l'historique mais absentes côté PostgreSQL.
 * Objectif: aligner le schéma et permettre l'import complet.
 */

exports.up = (pgm) => {
  // --- Backups historiques (pas utilisées par l'app) ---
  pgm.createTable(
    '__backup_arme',
    {
      id: { type: 'integer', primaryKey: true },
      config_arme_id: { type: 'integer' },
      numero_serie: { type: 'text' },
      etat: { type: 'text' },
      lot: { type: 'integer' },
      date_entree: { type: 'text' },
      date_sortie: { type: 'text' },
      statut: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_armes',
    {
      id: { type: 'integer', primaryKey: true },
      config_arme_id: { type: 'integer' },
      modele_id: { type: 'integer' },
      numero_serie: { type: 'text' },
      etat: { type: 'text' },
      lot_id: { type: 'integer' },
      position_id: { type: 'integer' },
      condition_id: { type: 'integer' },
      provenance_id: { type: 'integer' },
      date_entree: { type: 'text' },
      date_sortie: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
      entite_id: { type: 'integer' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_lot',
    {
      id: { type: 'integer', primaryKey: true },
      designation: { type: 'text' },
      date_debut: { type: 'text' },
      date_fin: { type: 'text' },
      description: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_munition',
    {
      id: { type: 'integer', primaryKey: true },
      config_munition_id: { type: 'integer' },
      total_entrees: { type: 'integer' },
      total_sorties: { type: 'integer' },
      balance: { type: 'integer' },
      code: { type: 'text' },
      seuil_critique: { type: 'integer' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_munitions',
    {
      id: { type: 'integer', primaryKey: true },
      config_munition_id: { type: 'integer' },
      total_entrees: { type: 'integer' },
      total_sorties: { type: 'integer' },
      balance: { type: 'integer' },
      code: { type: 'text' },
      seuil_critique: { type: 'integer' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_optique',
    {
      id: { type: 'integer', primaryKey: true },
      config_optique_id: { type: 'integer' },
      numero_serie: { type: 'text' },
      etat: { type: 'text' },
      date_entree: { type: 'text' },
      date_sortie: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    '__backup_optiques',
    {
      id: { type: 'integer', primaryKey: true },
      config_optique_id: { type: 'integer' },
      numero_serie: { type: 'text' },
      etat: { type: 'text' },
      date_entree: { type: 'text' },
      date_sortie: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'text' },
      synced: { type: 'integer' },
      deleted_at: { type: 'text' },
    },
    { ifNotExists: true }
  );

  // --- Tables historiques singulières (présentes dans certains dumps) ---
  pgm.createTable(
    'lot',
    {
      id: 'id',
      designation: { type: 'text', notNull: true },
      date_debut: { type: 'date' },
      date_fin: { type: 'date' },
      description: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'arme',
    {
      id: 'id',
      config_arme_id: { type: 'integer', notNull: true, references: 'config_arme', onDelete: 'restrict' },
      numero_serie: { type: 'text', notNull: true, unique: true },
      etat: { type: 'text' },
      lot: { type: 'integer', references: 'lot', onDelete: 'set null' },
      date_entree: { type: 'date' },
      date_sortie: { type: 'date' },
      statut: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'munition',
    {
      id: 'id',
      config_munition_id: {
        type: 'integer',
        notNull: true,
        unique: true,
        references: 'config_munition',
        onDelete: 'restrict',
      },
      total_entrees: { type: 'integer', default: 0 },
      total_sorties: { type: 'integer', default: 0 },
      balance: { type: 'integer', default: 0 },
      code: { type: 'text' },
      seuil_critique: { type: 'integer', default: 0 },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'optique',
    {
      id: 'id',
      config_optique_id: { type: 'integer', notNull: true, references: 'config_optique', onDelete: 'restrict' },
      numero_serie: { type: 'text', unique: true },
      etat: { type: 'text' },
      date_entree: { type: 'date' },
      date_sortie: { type: 'date' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'materiel_specifique',
    {
      id: 'id',
      config_materiel_id: { type: 'integer', notNull: true, references: 'config_materiel', onDelete: 'restrict' },
      numero_serie: { type: 'text', unique: true },
      etat: { type: 'text' },
      date_entree: { type: 'date' },
      date_sortie: { type: 'date' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'transaction_munition',
    {
      id: 'id',
      config_munition_id: {
        type: 'integer',
        notNull: true,
        references: 'config_munition',
        onDelete: 'restrict',
      },
      type_operation: { type: 'text', notNull: true },
      quantite: { type: 'integer', notNull: true },
      date_operation: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
      code: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );
  pgm.addConstraint(
    'transaction_munition',
    'transaction_munition_type_operation_chk',
    "CHECK (type_operation IN ('ENTREE','SORTIE','DOTATION'))"
  );
  pgm.addConstraint('transaction_munition', 'transaction_munition_quantite_chk', 'CHECK (quantite > 0)');

  // --- Coordinations (hiérarchie) ---
  pgm.createTable(
    'coordination_regionale',
    {
      id: 'id',
      nom: { type: 'text', notNull: true },
      code: { type: 'text' },
      region_id: { type: 'integer', notNull: true, references: 'regions', onDelete: 'restrict' },
      description: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'coordination_provinciale',
    {
      id: 'id',
      nom: { type: 'text', notNull: true },
      code: { type: 'text' },
      province_id: { type: 'integer', notNull: true, references: 'provinces', onDelete: 'restrict' },
      region_id: { type: 'integer', notNull: true, references: 'regions', onDelete: 'restrict' },
      parent_id: { type: 'integer', notNull: true, references: 'coordination_regionale', onDelete: 'restrict' },
      description: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'coordination_communale',
    {
      id: 'id',
      nom: { type: 'text', notNull: true },
      code: { type: 'text' },
      commune_id: { type: 'integer', notNull: true, references: 'communes', onDelete: 'restrict' },
      province_id: { type: 'integer', notNull: true, references: 'provinces', onDelete: 'restrict' },
      region_id: { type: 'integer', notNull: true, references: 'regions', onDelete: 'restrict' },
      parent_id: { type: 'integer', notNull: true, references: 'coordination_provinciale', onDelete: 'restrict' },
      description: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'localite_coordination',
    {
      id: 'id',
      localite_id: { type: 'integer', notNull: true, references: 'localites', onDelete: 'cascade' },
      coordination_commune_id: {
        type: 'integer',
        notNull: true,
        references: 'coordination_communale',
        onDelete: 'cascade',
      },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  // --- Munitions: transactions/mouvements/alertes ---
  pgm.createTable(
    'alertes_munitions',
    {
      id: 'id',
      munition_id: { type: 'integer', notNull: true, references: 'munitions', onDelete: 'restrict' },
      config_munition_id: { type: 'integer', notNull: true, references: 'config_munition', onDelete: 'restrict' },
      type_alerte: { type: 'text', notNull: true },
      niveau: { type: 'text', notNull: true },
      message: { type: 'text', notNull: true },
      date_alerte: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      date_resolution: { type: 'timestamptz' },
      statut: { type: 'text', default: 'ACTIVE' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );
  pgm.addConstraint(
    'alertes_munitions',
    'alertes_munitions_type_chk',
    "CHECK (type_alerte IN ('SEUIL_CRITIQUE','PEREMPTION','RUPTURE'))"
  );
  pgm.addConstraint(
    'alertes_munitions',
    'alertes_munitions_niveau_chk',
    "CHECK (niveau IN ('INFO','WARNING','CRITICAL'))"
  );
  pgm.addConstraint(
    'alertes_munitions',
    'alertes_munitions_statut_chk',
    "CHECK (statut IN ('ACTIVE','RESOLVED','IGNORED'))"
  );

  pgm.createTable(
    'mouvements_munitions',
    {
      id: 'id',
      munition_id: { type: 'integer', notNull: true, references: 'munitions', onDelete: 'restrict' },
      config_munition_id: { type: 'integer', notNull: true, references: 'config_munition', onDelete: 'restrict' },
      type_mouvement: { type: 'text', notNull: true },
      quantite: { type: 'integer', notNull: true },
      quantite_avant: { type: 'integer', default: 0 },
      quantite_apres: { type: 'integer', default: 0 },
      date_mouvement: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      reference_piece: { type: 'text' },
      origine: { type: 'text' },
      destination: { type: 'text' },
      vdp_id: { type: 'integer', references: 'vdp', onDelete: 'set null' },
      entite_origine_id: { type: 'integer', references: 'entites', onDelete: 'set null' },
      entite_destination_id: { type: 'integer', references: 'entites', onDelete: 'set null' },
      localite_id: { type: 'integer', references: 'localites', onDelete: 'set null' },
      utilisateur_id: { type: 'integer', references: 'utilisateurs', onDelete: 'set null' },
      motif: { type: 'text' },
      observations: { type: 'text' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );
  pgm.addConstraint(
    'mouvements_munitions',
    'mouvements_munitions_type_chk',
    "CHECK (type_mouvement IN ('ENTREE','SORTIE','DOTATION','TRANSFERT','INVENTAIRE'))"
  );

  // --- Sources armes (exposée par /api/sources_armes) ---
  pgm.createTable(
    'sources_armes',
    {
      id: 'id',
      code: { type: 'text', unique: true },
      nom: { type: 'text', notNull: true },
      description: { type: 'text' },
      provenance: { type: 'text' },
      source_dotation_id: { type: 'integer', references: 'sources_dotation', onDelete: 'set null' },
      date_reception: { type: 'text' },
      date_cloture: { type: 'text' },
      created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      updated_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  // --- Audits historiques ---
  pgm.createTable(
    'armes_audit',
    {
      id: 'id',
      arme_id: { type: 'integer', notNull: true },
      action: { type: 'text', notNull: true },
      actor_id: { type: 'integer' },
      actor_name: { type: 'text' },
      timestamp: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      delta: { type: 'jsonb' },
      snapshot: { type: 'jsonb' },
      created_at: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'materiels_specifiques_audit',
    {
      id: 'id',
      materiel_id: { type: 'integer', notNull: true },
      action: { type: 'text', notNull: true },
      actor_id: { type: 'integer' },
      actor_name: { type: 'text' },
      timestamp: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      delta: { type: 'jsonb' },
      snapshot: { type: 'jsonb' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'munitions_audit',
    {
      id: 'id',
      tx_id: { type: 'integer' },
      action: { type: 'text', notNull: true },
      actor_id: { type: 'integer' },
      actor_name: { type: 'text' },
      timestamp: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      delta: { type: 'jsonb' },
      snapshot: { type: 'jsonb' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'optiques_audit',
    {
      id: 'id',
      optique_id: { type: 'integer', notNull: true },
      action: { type: 'text', notNull: true },
      actor_id: { type: 'integer' },
      actor_name: { type: 'text' },
      timestamp: { type: 'timestamptz', default: pgm.func('CURRENT_TIMESTAMP') },
      delta: { type: 'jsonb' },
      snapshot: { type: 'jsonb' },
    },
    { ifNotExists: true }
  );

  // --- Villages (tables annexes) ---
  pgm.createTable(
    'villages',
    {
      id: 'id',
      nom: { type: 'text', notNull: true },
      code: { type: 'text' },
      commune_id: { type: 'integer', notNull: true, references: 'communes', onDelete: 'restrict' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );

  pgm.createTable(
    'villages_secteurs',
    {
      id: 'id',
      nom: { type: 'text', notNull: true },
      code: { type: 'text' },
      commune_id: { type: 'integer', notNull: true, references: 'communes', onDelete: 'restrict' },
      uuid: { type: 'text' },
      updated_at: { type: 'timestamptz' },
      synced: { type: 'integer', default: 0 },
      deleted_at: { type: 'timestamptz' },
    },
    { ifNotExists: true }
  );
};

exports.down = (pgm) => {
  // Drop dans l'ordre inverse pour éviter des soucis de FK
  pgm.dropTable('villages_secteurs', { ifExists: true });
  pgm.dropTable('villages', { ifExists: true });
  pgm.dropTable('optiques_audit', { ifExists: true });
  pgm.dropTable('munitions_audit', { ifExists: true });
  pgm.dropTable('materiels_specifiques_audit', { ifExists: true });
  pgm.dropTable('armes_audit', { ifExists: true });
  pgm.dropTable('sources_armes', { ifExists: true });
  pgm.dropTable('mouvements_munitions', { ifExists: true });
  pgm.dropTable('alertes_munitions', { ifExists: true });
  pgm.dropTable('localite_coordination', { ifExists: true });
  pgm.dropTable('coordination_communale', { ifExists: true });
  pgm.dropTable('coordination_provinciale', { ifExists: true });
  pgm.dropTable('coordination_regionale', { ifExists: true });
  pgm.dropTable('transaction_munition', { ifExists: true });
  pgm.dropTable('materiel_specifique', { ifExists: true });
  pgm.dropTable('optique', { ifExists: true });
  pgm.dropTable('munition', { ifExists: true });
  pgm.dropTable('arme', { ifExists: true });
  pgm.dropTable('lot', { ifExists: true });
  pgm.dropTable('__backup_optiques', { ifExists: true });
  pgm.dropTable('__backup_optique', { ifExists: true });
  pgm.dropTable('__backup_munitions', { ifExists: true });
  pgm.dropTable('__backup_munition', { ifExists: true });
  pgm.dropTable('__backup_lot', { ifExists: true });
  pgm.dropTable('__backup_armes', { ifExists: true });
  pgm.dropTable('__backup_arme', { ifExists: true });
};
