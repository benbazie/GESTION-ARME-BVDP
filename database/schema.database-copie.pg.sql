CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Schéma PostgreSQL aligné sur `database/database - Copie.js`
-- Objectif: être idempotent et NON destructif (préserve les données).
-- ------------------------------------------------------------

-- ---- Tables de coordinations hiérarchiques ----
CREATE TABLE IF NOT EXISTS coordination_regionale (
  id            SERIAL PRIMARY KEY,
  nom           TEXT NOT NULL,
  code          TEXT NOT NULL DEFAULT '',
  entite_id     INTEGER REFERENCES entites(id),
  region_id     INTEGER NOT NULL REFERENCES regions(id),
  description   TEXT,
  uuid          UUID DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced        BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ
);

ALTER TABLE coordination_regionale ADD COLUMN IF NOT EXISTS entite_id INTEGER REFERENCES entites(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS coordination_provinciale (
  id            SERIAL PRIMARY KEY,
  nom           TEXT NOT NULL,
  code          TEXT NOT NULL DEFAULT '',
  province_id   INTEGER NOT NULL REFERENCES provinces(id),
  region_id     INTEGER NOT NULL REFERENCES regions(id),
  parent_id     INTEGER NOT NULL REFERENCES coordination_regionale(id),
  description   TEXT,
  uuid          UUID DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced        BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS coordination_communale (
  id            SERIAL PRIMARY KEY,
  nom           TEXT NOT NULL,
  code          TEXT NOT NULL DEFAULT '',
  commune_id    INTEGER NOT NULL REFERENCES communes(id),
  province_id   INTEGER NOT NULL REFERENCES provinces(id),
  region_id     INTEGER NOT NULL REFERENCES regions(id),
  parent_id     INTEGER NOT NULL REFERENCES coordination_provinciale(id),
  description   TEXT,
  uuid          UUID DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced        BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS localite_coordination (
  id                       SERIAL PRIMARY KEY,
  localite_id               INTEGER NOT NULL REFERENCES localites(id),
  coordination_commune_id   INTEGER NOT NULL REFERENCES coordination_communale(id),
  uuid          UUID DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced        BOOLEAN DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ
);

-- ---- Sources armes (remplace/complète la notion de lots) ----
CREATE TABLE IF NOT EXISTS sources_armes (
  id                SERIAL PRIMARY KEY,
  code              TEXT UNIQUE,
  nom               TEXT NOT NULL,
  description       TEXT,
  provenance        TEXT,
  source_dotation_id INTEGER REFERENCES sources_dotation(id),
  date_reception    DATE,
  date_cloture      DATE,
  uuid              UUID DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced            BOOLEAN DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ
);

-- ---- Dotations (nouvelle structure) ----
CREATE TABLE IF NOT EXISTS dotation_items (
  id                 SERIAL PRIMARY KEY,
  dotation_id         INTEGER NOT NULL REFERENCES dotations(id) ON DELETE CASCADE,
  arme_id             INTEGER REFERENCES armes(id),
  resource_type       TEXT DEFAULT 'arme',
  resource_id         INTEGER,
  quantite            INTEGER DEFAULT 1,
  status              TEXT DEFAULT 'assigné',
  condition_initiale  TEXT,
  condition_retour    TEXT,
  returned_at         TIMESTAMPTZ,
  returned_by         INTEGER,
  created_by          INTEGER,
  updated_by          INTEGER,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced              BOOLEAN DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Ajouts de colonnes (idempotent)
-- ------------------------------------------------------------

-- geo lat/long
ALTER TABLE regions   ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE regions   ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE communes  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE communes  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE localites ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE localites ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- vdp : colonnes hiérarchie coordinations + geo (certaines existent déjà)
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS coordination_regionale_id    INTEGER REFERENCES coordination_regionale(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS coordination_provinciale_id  INTEGER REFERENCES coordination_provinciale(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS coordination_communale_id    INTEGER REFERENCES coordination_communale(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE vdp ADD COLUMN IF NOT EXISTS region_id    INTEGER REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS province_id  INTEGER REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS commune_id   INTEGER REFERENCES communes(id)  ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE vdp ADD COLUMN IF NOT EXISTS localite_id  INTEGER REFERENCES localites(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- armes : colonnes enrichies (héritées SQLite)
ALTER TABLE armes ADD COLUMN IF NOT EXISTS source_arme_id INTEGER REFERENCES sources_armes(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS entite_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS sous_entite_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS province_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS commune_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS localite_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS coordination_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS sous_coordination_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS coordination_regionale_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS coordination_provinciale_id INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS coordination_communale_id INTEGER;

-- optiques / matériels / munitions : hiérarchie de coordination (utilisée par filtres et dashboards)
ALTER TABLE optiques ADD COLUMN IF NOT EXISTS coordination_regionale_id   INTEGER REFERENCES coordination_regionale(id)   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE optiques ADD COLUMN IF NOT EXISTS coordination_provinciale_id INTEGER REFERENCES coordination_provinciale(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE optiques ADD COLUMN IF NOT EXISTS coordination_communale_id   INTEGER REFERENCES coordination_communale(id)   ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE materiels_specifiques ADD COLUMN IF NOT EXISTS coordination_regionale_id   INTEGER REFERENCES coordination_regionale(id)   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE materiels_specifiques ADD COLUMN IF NOT EXISTS coordination_provinciale_id INTEGER REFERENCES coordination_provinciale(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE materiels_specifiques ADD COLUMN IF NOT EXISTS coordination_communale_id   INTEGER REFERENCES coordination_communale(id)   ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE munitions ADD COLUMN IF NOT EXISTS coordination_regionale_id   INTEGER REFERENCES coordination_regionale(id)   ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE munitions ADD COLUMN IF NOT EXISTS coordination_provinciale_id INTEGER REFERENCES coordination_provinciale(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE munitions ADD COLUMN IF NOT EXISTS coordination_communale_id   INTEGER REFERENCES coordination_communale(id)   ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE armes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS categorie TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS statut TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'entite';

ALTER TABLE armes ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS deleted_by INTEGER;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS deleted INTEGER DEFAULT 0;

ALTER TABLE armes ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS mobilite TEXT DEFAULT 'normale';
ALTER TABLE armes ADD COLUMN IF NOT EXISTS position TEXT DEFAULT '';
ALTER TABLE armes ADD COLUMN IF NOT EXISTS calibre TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS annee_fabrication TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS marque TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS modele TEXT;
ALTER TABLE armes ADD COLUMN IF NOT EXISTS pays_origine TEXT;

-- utilisateurs : infos profil & rattachements
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS nom TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS prenom TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS entite_id INTEGER REFERENCES entites(id);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS sous_entite_id INTEGER REFERENCES sous_entites(id);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS coordination_regionale_id INTEGER REFERENCES coordination_regionale(id);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS coordination_provinciale_id INTEGER REFERENCES coordination_provinciale(id);
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS coordination_communale_id INTEGER REFERENCES coordination_communale(id);

-- dotations : colonnes "nouvelle" structure (si la table existe déjà, on complète)
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS dotation_type TEXT DEFAULT 'individuelle';
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS beneficiary_type TEXT DEFAULT 'vdp';
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS sous_entite_id INTEGER;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS coordination_id INTEGER;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS source_id INTEGER;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_cours';
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS date_prevue_retour DATE;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS date_cloture DATE;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE dotations ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

-- ------------------------------------------------------------
-- Trigger Postgres : propagation geo vers VDP lors d'une dotation d'arme
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_dotation_propagate_geo_to_vdp_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resource_type = 'arme' AND NEW.resource_id IS NOT NULL THEN
    UPDATE vdp
    SET
      region_id = COALESCE((SELECT region_id FROM armes WHERE id = NEW.resource_id), vdp.region_id),
      province_id = COALESCE((SELECT province_id FROM armes WHERE id = NEW.resource_id), vdp.province_id),
      commune_id = COALESCE((SELECT commune_id FROM armes WHERE id = NEW.resource_id), vdp.commune_id),
      localite_id = COALESCE((SELECT localite_id FROM armes WHERE id = NEW.resource_id), vdp.localite_id),
      coordination_regionale_id = COALESCE((SELECT coordination_regionale_id FROM armes WHERE id = NEW.resource_id), vdp.coordination_regionale_id),
      coordination_provinciale_id = COALESCE((SELECT coordination_provinciale_id FROM armes WHERE id = NEW.resource_id), vdp.coordination_provinciale_id),
      coordination_communale_id = COALESCE((SELECT coordination_communale_id FROM armes WHERE id = NEW.resource_id), vdp.coordination_communale_id),
      entite_id = COALESCE((SELECT entite_id FROM armes WHERE id = NEW.resource_id), vdp.entite_id),
      sous_entite_id = COALESCE((SELECT sous_entite_id FROM armes WHERE id = NEW.resource_id), vdp.sous_entite_id),
      updated_at = CURRENT_TIMESTAMP
    WHERE vdp.id = (SELECT vdp_id FROM dotations WHERE id = NEW.dotation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dotation_propagate_geo_to_vdp ON dotation_items;
CREATE TRIGGER trg_dotation_propagate_geo_to_vdp
AFTER INSERT OR UPDATE ON dotation_items
FOR EACH ROW
EXECUTE FUNCTION trg_dotation_propagate_geo_to_vdp_fn();
