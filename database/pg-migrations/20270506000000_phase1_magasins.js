'use strict';

/**
 * Phase 1 — Module Magasin & Refonte Dotations
 *
 * Nouvelles tables :
 *   - magasins           : armureries par niveau hiérarchique
 *   - stock_magasin      : inventaire courant
 *   - mouvements_magasin : journal immuable des mouvements
 *   - dotation_logs      : journal d'audit des actions sur dotations
 *
 * Modifications :
 *   - armes      : +magasin_id, +statut
 *   - dotations  : +magasin_source_id, +created_by, +validated_by, +validated_at
 *   - dotation_items : +created_by
 */

exports.up = (pgm) => {

  /* ------------------------------------------------------------------ */
  /*  TABLE : magasins                                                    */
  /* ------------------------------------------------------------------ */
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS magasins (
      id          SERIAL PRIMARY KEY,
      nom         TEXT NOT NULL,
      code        TEXT,

      -- rattachement à UN seul niveau (un seul non-null)
      entite_id                   INTEGER REFERENCES entites(id)                    ON DELETE SET NULL,
      coordination_regionale_id   INTEGER REFERENCES coordination_regionale(id)     ON DELETE SET NULL,
      coordination_provinciale_id INTEGER REFERENCES coordination_provinciale(id)   ON DELETE SET NULL,
      coordination_communale_id   INTEGER REFERENCES coordination_communale(id)     ON DELETE SET NULL,
      localite_id                 INTEGER REFERENCES localites(id)                  ON DELETE SET NULL,

      gestionnaire_id  INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
      niveau           TEXT NOT NULL DEFAULT 'local',
      -- 'central'|'division'|'bataillon'|'centre_formation'
      -- |'regional'|'provincial'|'communal'|'localite'

      actif            BOOLEAN NOT NULL DEFAULT TRUE,
      observation      TEXT,

      uuid        UUID        DEFAULT gen_random_uuid(),
      created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      deleted_at  TIMESTAMPTZ,
      synced      BOOLEAN     DEFAULT FALSE
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_magasins_entite   ON magasins(entite_id)   WHERE deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_magasins_localite ON magasins(localite_id) WHERE deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_magasins_coord_com ON magasins(coordination_communale_id)   WHERE deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_magasins_coord_prov ON magasins(coordination_provinciale_id) WHERE deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_magasins_coord_reg  ON magasins(coordination_regionale_id)   WHERE deleted_at IS NULL;`);

  /* ------------------------------------------------------------------ */
  /*  TABLE : stock_magasin                                               */
  /* ------------------------------------------------------------------ */
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS stock_magasin (
      id             SERIAL PRIMARY KEY,
      magasin_id     INTEGER NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
      resource_type  TEXT NOT NULL,
      -- 'arme'|'optique'|'materiel_specifique'|'munition'
      resource_id    INTEGER NOT NULL,
      quantite       INTEGER NOT NULL DEFAULT 1,
      -- 1 pour armes/optiques/matériels, N pour munitions

      created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT uq_stock_item UNIQUE(magasin_id, resource_type, resource_id)
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_stock_magasin_id   ON stock_magasin(magasin_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_stock_resource     ON stock_magasin(resource_type, resource_id);`);

  /* ------------------------------------------------------------------ */
  /*  TABLE : mouvements_magasin                                          */
  /* ------------------------------------------------------------------ */
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS mouvements_magasin (
      id              SERIAL PRIMARY KEY,
      magasin_id      INTEGER NOT NULL REFERENCES magasins(id) ON DELETE RESTRICT,
      type            TEXT NOT NULL,
      -- 'entree_lot'         : réception depuis un lot
      -- 'entree_manuelle'    : saisie manuelle (stock initial)
      -- 'sortie_dotation'    : dotation individuelle ou collective
      -- 'retour_vdp'         : réintégration VDP → magasin
      -- 'reversal_entite'    : reversal entité → magasin sup ou central
      -- 'transfert_sortant'  : transfert vers autre magasin
      -- 'transfert_entrant'  : réception depuis autre magasin
      -- 'perte'              : arme perdue
      -- 'destruction'        : arme détruite

      resource_type   TEXT NOT NULL,
      resource_id     INTEGER,
      quantite        INTEGER NOT NULL DEFAULT 1,

      dotation_id     INTEGER REFERENCES dotations(id)    ON DELETE SET NULL,
      lot_id          INTEGER REFERENCES lots(id)         ON DELETE SET NULL,
      magasin_dest_id INTEGER REFERENCES magasins(id)     ON DELETE SET NULL,
      -- magasin destination (transfert) ou source (retour)

      acteur_id       INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
      acteur_nom      TEXT,   -- snapshot au moment de l'action
      acteur_role     TEXT,

      date_mouvement  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      observation     TEXT,

      uuid        UUID        DEFAULT gen_random_uuid(),
      created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      synced      BOOLEAN     DEFAULT FALSE
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mvt_magasin_id  ON mouvements_magasin(magasin_id);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mvt_dotation    ON mouvements_magasin(dotation_id) WHERE dotation_id IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mvt_date        ON mouvements_magasin(date_mouvement DESC);`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_mvt_resource    ON mouvements_magasin(resource_type, resource_id);`);

  /* ------------------------------------------------------------------ */
  /*  TABLE : dotation_logs  (journal immuable)                          */
  /* ------------------------------------------------------------------ */
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS dotation_logs (
      id            SERIAL PRIMARY KEY,
      dotation_id   INTEGER REFERENCES dotations(id) ON DELETE SET NULL,
      type_action   TEXT NOT NULL,
      -- 'creation' | 'validation' | 'modification'
      -- | 'reintegration_partielle' | 'reintegration_totale'
      -- | 'reversal' | 'cloture' | 'annulation' | 'transfert'

      acteur_id     INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
      acteur_nom    TEXT,   -- snapshot nom complet + grade
      acteur_role   TEXT,   -- snapshot rôle

      magasin_id    INTEGER REFERENCES magasins(id) ON DELETE SET NULL,
      details       JSONB,  -- { items, conditions, observation, ... }
      ip_address    TEXT,

      created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      synced        BOOLEAN     DEFAULT FALSE
    );
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dlog_dotation ON dotation_logs(dotation_id) WHERE dotation_id IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dlog_acteur   ON dotation_logs(acteur_id)   WHERE acteur_id   IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dlog_date     ON dotation_logs(created_at DESC);`);

  /* ------------------------------------------------------------------ */
  /*  ALTER : armes — magasin_id + statut                                */
  /* ------------------------------------------------------------------ */
  pgm.sql(`ALTER TABLE armes ADD COLUMN IF NOT EXISTS magasin_id INTEGER REFERENCES magasins(id) ON DELETE SET NULL;`);
  pgm.sql(`ALTER TABLE armes ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'disponible';`);
  // statut : 'disponible'|'en_stock'|'dotee'|'dotee_collectif'|'perdue'|'detruite'|'maintenance'
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_armes_magasin ON armes(magasin_id) WHERE magasin_id IS NOT NULL AND deleted_at IS NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_armes_statut  ON armes(statut)     WHERE deleted_at IS NULL;`);

  /* ------------------------------------------------------------------ */
  /*  ALTER : dotations — traçabilité complète                           */
  /* ------------------------------------------------------------------ */
  pgm.sql(`ALTER TABLE dotations ADD COLUMN IF NOT EXISTS magasin_source_id INTEGER REFERENCES magasins(id) ON DELETE SET NULL;`);
  pgm.sql(`ALTER TABLE dotations ADD COLUMN IF NOT EXISTS created_by   INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL;`);
  pgm.sql(`ALTER TABLE dotations ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL;`);
  pgm.sql(`ALTER TABLE dotations ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;`);
  pgm.sql(`ALTER TABLE dotations ADD COLUMN IF NOT EXISTS code TEXT;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dotations_magasin ON dotations(magasin_source_id) WHERE magasin_source_id IS NOT NULL;`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_dotations_created_by ON dotations(created_by) WHERE created_by IS NOT NULL;`);

  /* ------------------------------------------------------------------ */
  /*  ALTER : dotation_items — traçabilité                               */
  /* ------------------------------------------------------------------ */
  pgm.sql(`ALTER TABLE dotation_items ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL;`);

};

exports.down = (pgm) => {
  // Suppression dans l'ordre inverse des dépendances
  pgm.sql(`ALTER TABLE dotation_items DROP COLUMN IF EXISTS created_by;`);

  pgm.sql(`ALTER TABLE dotations DROP COLUMN IF EXISTS magasin_source_id;`);
  pgm.sql(`ALTER TABLE dotations DROP COLUMN IF EXISTS created_by;`);
  pgm.sql(`ALTER TABLE dotations DROP COLUMN IF EXISTS validated_by;`);
  pgm.sql(`ALTER TABLE dotations DROP COLUMN IF EXISTS validated_at;`);
  pgm.sql(`ALTER TABLE dotations DROP COLUMN IF EXISTS code;`);

  pgm.sql(`ALTER TABLE armes DROP COLUMN IF EXISTS magasin_id;`);
  pgm.sql(`ALTER TABLE armes DROP COLUMN IF EXISTS statut;`);

  pgm.sql(`DROP TABLE IF EXISTS dotation_logs;`);
  pgm.sql(`DROP TABLE IF EXISTS mouvements_magasin;`);
  pgm.sql(`DROP TABLE IF EXISTS stock_magasin;`);
  pgm.sql(`DROP TABLE IF EXISTS magasins;`);
};
