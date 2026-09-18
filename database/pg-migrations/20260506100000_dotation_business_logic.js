/**
 * Migration : Logique métier dotation — indexes de performance + contraintes
 *
 * - Index sur dotation_items (resource_type, resource_id, status) pour le
 *   contrôle de disponibilité (checkAvailability).
 * - Index sur chain_of_custody (ressource_type, ressource_id) pour les
 *   ouvertures/fermetures de garde.
 * - Valeur par défaut 'disponible' sur etat de armes/optiques/materiels_specifiques
 *   afin que les ressources soient disponibles à la création.
 * - Colonne deleted_by sur dotations (si absente).
 * - Colonne arme_id supprimée de dotation_items si elle existe (colonne fantôme
 *   introduite par l'ancien controller).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {

  // ── Index dotation_items ───────────────────────────────────────────────────
  // Utilisé par checkAvailability : recherche par (resource_type, resource_id, status)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_dotation_items_resource
      ON dotation_items (resource_type, resource_id, status)
      WHERE deleted_at IS NULL;
  `);

  // Utilisé par replaceItems / fetchOne : toutes les lignes d'une dotation
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_dotation_items_dotation_id
      ON dotation_items (dotation_id)
      WHERE deleted_at IS NULL;
  `);

  // ── Index chain_of_custody ────────────────────────────────────────────────
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_coc_resource
      ON chain_of_custody (ressource_type, ressource_id)
      WHERE ended_at IS NULL AND deleted_at IS NULL;
  `);

  // ── Index dotations ───────────────────────────────────────────────────────
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_dotations_vdp_statut
      ON dotations (vdp_id, statut)
      WHERE deleted_at IS NULL;
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_dotations_entite_statut
      ON dotations (entite_id, statut)
      WHERE deleted_at IS NULL;
  `);

  // ── Valeurs par défaut etat des ressources ────────────────────────────────
  // Permet à markAssigned / markReturned de fonctionner même si etat est NULL.
  pgm.sql(`
    UPDATE armes SET etat = 'disponible'
    WHERE etat IS NULL AND deleted_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'arme'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);
  pgm.sql(`
    UPDATE optiques SET etat = 'disponible'
    WHERE etat IS NULL AND deleted_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'optique'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);
  pgm.sql(`
    UPDATE materiels_specifiques SET etat = 'disponible'
    WHERE etat IS NULL AND deleted_at IS NULL
      AND id NOT IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'materiel_specifique'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);

  // ── Resynchroniser les ressources déjà en dotation active ─────────────────
  // Corrige les ressources dont etat ne reflétait pas leur état réel.
  pgm.sql(`
    UPDATE armes SET etat = 'en_dotation'
    WHERE deleted_at IS NULL
      AND id IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'arme'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);
  pgm.sql(`
    UPDATE optiques SET etat = 'en_dotation'
    WHERE deleted_at IS NULL
      AND id IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'optique'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);
  pgm.sql(`
    UPDATE materiels_specifiques SET etat = 'en_dotation'
    WHERE deleted_at IS NULL
      AND id IN (
        SELECT DISTINCT di.resource_id
        FROM dotation_items di
        JOIN dotations d ON d.id = di.dotation_id
        WHERE di.resource_type = 'materiel_specifique'
          AND di.status = 'assigné'
          AND di.deleted_at IS NULL
          AND d.deleted_at  IS NULL
          AND d.statut NOT IN ('returned', 'cloturee', 'annulee')
      );
  `);

  // ── Colonne deleted_by sur dotations (si absente) ─────────────────────────
  pgm.sql(`ALTER TABLE IF EXISTS dotations ADD COLUMN IF NOT EXISTS deleted_by INTEGER;`);

  // ── Supprimer la colonne fantôme arme_id de dotation_items si elle existe ─
  // L'ancien controller tentait d'insérer arme_id qui n'est pas dans le schema.
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dotation_items' AND column_name = 'arme_id'
      ) THEN
        ALTER TABLE dotation_items DROP COLUMN arme_id;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_dotation_items_resource;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_dotation_items_dotation_id;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_coc_resource;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_dotations_vdp_statut;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_dotations_entite_statut;`);
};
