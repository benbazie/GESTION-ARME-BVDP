'use strict';

exports.up = (pgm) => {
  const cols = [
    ['nom_jf',             'TEXT'],
    ['niveau_instruction', 'TEXT'],
    ['emploi_tenu',        'TEXT'],
    ['nom_bapteme',        'TEXT'],
    ['nom_promotion',      'TEXT'],
    ['nb_femme',           'INTEGER'],
    ['no_matricule',       'TEXT'],
    ['id_identification',  'TEXT'],
    ['id_promotion',       'TEXT'],
    ['personne_prevenir2', 'TEXT'],
    ['contact_pers_prev2', 'TEXT'],
    ['localite_origine',   'TEXT'],
  ];

  for (const [col, type] of cols) {
    pgm.sql(`
      ALTER TABLE vdp ADD COLUMN IF NOT EXISTS ${col} ${type}
    `);
  }
};

exports.down = (pgm) => {
  const cols = [
    'nom_jf', 'niveau_instruction', 'emploi_tenu', 'nom_bapteme',
    'nom_promotion', 'nb_femme', 'no_matricule', 'id_identification',
    'id_promotion', 'personne_prevenir2', 'contact_pers_prev2', 'localite_origine',
  ];
  for (const col of cols) {
    pgm.sql(`ALTER TABLE vdp DROP COLUMN IF EXISTS ${col}`);
  }
};
