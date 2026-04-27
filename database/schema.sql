CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS regions (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  code            TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS provinces (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  code            TEXT,
  region_id       INTEGER NOT NULL REFERENCES regions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS communes (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  code            TEXT,
  province_id     INTEGER NOT NULL REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  region_id       INTEGER NOT NULL REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS localites (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  code            TEXT,
  province_id     INTEGER NOT NULL REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  region_id       INTEGER NOT NULL REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
  commune_id      INTEGER NOT NULL REFERENCES communes(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS entites (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  code            TEXT NOT NULL,
  type            TEXT NOT NULL,
  description     TEXT,
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  date_creation   DATE DEFAULT CURRENT_DATE,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sous_entites (
  id              SERIAL PRIMARY KEY,
  entite_id       INTEGER NOT NULL REFERENCES entites(id),
  nom             TEXT NOT NULL,
  code            TEXT NOT NULL,
  type            TEXT NOT NULL,
  description     TEXT,
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  date_creation   DATE DEFAULT CURRENT_DATE,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS coordinations (
  id              SERIAL PRIMARY KEY,
  entite_id       INTEGER NOT NULL REFERENCES entites(id),
  nom             TEXT NOT NULL,
  code            TEXT NOT NULL,
  type            TEXT NOT NULL,
  description     TEXT,
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  date_creation   DATE DEFAULT CURRENT_DATE,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS vdp (
  id               SERIAL PRIMARY KEY,
  nom              TEXT NOT NULL,
  prenom           TEXT NOT NULL,
  date_naissance   DATE,
  lieu_naissance   TEXT,
  sexe             TEXT,
  numero_cnib      TEXT,
  date_cnib        DATE,
  date_recrutement DATE,
  statut_vdp       TEXT,
  statut_matrimonial TEXT,
  nb_enfants       INTEGER,
  entite_id        INTEGER NOT NULL REFERENCES entites(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  sous_entite_id   INTEGER REFERENCES sous_entites(id) ON UPDATE CASCADE ON DELETE SET NULL,
  coordination_id  INTEGER REFERENCES coordinations(id) ON UPDATE CASCADE ON DELETE SET NULL,
  type_vdp         TEXT,
  contacts         TEXT,
  photo            BYTEA,
  observation      TEXT,
  code_qr          TEXT,
  contact_urgence1 TEXT NOT NULL,
  contact_urgence2 TEXT,
  contact_urgence3 TEXT,
  nom_personne_prevenir TEXT,
  lien_personne_prevenir TEXT,
  region_id        INTEGER REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE SET NULL,
  province_id      INTEGER REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE SET NULL,
  commune_id       INTEGER REFERENCES communes(id)  ON UPDATE CASCADE ON DELETE SET NULL,
  localite_id      INTEGER REFERENCES localites(id) ON UPDATE CASCADE ON DELETE SET NULL,
  uuid             UUID DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMPTZ,
  synced           BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS types_arme (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL UNIQUE,
  description     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS categories_arme (
  id              SERIAL PRIMARY KEY,
  type_id         INTEGER NOT NULL REFERENCES types_arme(id),
  nom             TEXT NOT NULL,
  code            TEXT,
  description     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE,
  UNIQUE(type_id, nom)
);

CREATE TABLE IF NOT EXISTS modeles_arme (
  id              SERIAL PRIMARY KEY,
  categorie_id    INTEGER NOT NULL REFERENCES categories_arme(id),
  nom             TEXT NOT NULL,
  calibre         TEXT,
  pays_origine    TEXT,
  observation     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE,
  UNIQUE(categorie_id, nom)
);

CREATE TABLE IF NOT EXISTS sources_dotation (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL UNIQUE,
  details         TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lots (
  id              SERIAL PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES sources_dotation(id),
  designation     TEXT,
  periode_debut   DATE,
  periode_fin     DATE,
  justificatif    TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS etats_position (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  libelle         TEXT NOT NULL,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS conditions_techniques (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  libelle         TEXT NOT NULL,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS provenance_tactique (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  libelle         TEXT NOT NULL,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config_arme (
  id              SERIAL PRIMARY KEY,
  categorie_id    INTEGER REFERENCES categories_arme(id),
  designation     TEXT NOT NULL,
  type            TEXT,
  categorie       TEXT,
  observation     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config_optique (
  id              SERIAL PRIMARY KEY,
  type            TEXT NOT NULL,
  categorie       TEXT,
  designation     TEXT NOT NULL,
  observation     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config_materiel (
  id              SERIAL PRIMARY KEY,
  type            TEXT NOT NULL,
  categorie       TEXT,
  designation     TEXT NOT NULL,
  observation     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS armes (
  id              SERIAL PRIMARY KEY,
  config_arme_id  INTEGER NOT NULL REFERENCES config_arme(id),
  entite_id       INTEGER REFERENCES entites(id),
  modele_id       INTEGER REFERENCES modeles_arme(id),
  numero_serie    TEXT NOT NULL UNIQUE,
  etat            TEXT,
  lot_id          INTEGER REFERENCES lots(id),
  position_id     INTEGER NOT NULL REFERENCES etats_position(id)       DEFAULT 1,
  condition_id    INTEGER NOT NULL REFERENCES conditions_techniques(id) DEFAULT 1,
  provenance_id   INTEGER NOT NULL REFERENCES provenance_tactique(id)  DEFAULT 1,
  date_entree     DATE,
  date_sortie     DATE,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS optiques (
  id              SERIAL PRIMARY KEY,
  config_optique_id INTEGER NOT NULL REFERENCES config_optique(id),
  numero_serie    TEXT UNIQUE,
  etat            TEXT,
  date_entree     DATE,
  date_sortie     DATE,
  entite_id       INTEGER REFERENCES entites(id),
  sous_entite_id  INTEGER REFERENCES sous_entites(id),
  coordination_id INTEGER REFERENCES coordinations(id),
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS materiels_specifiques (
  id              SERIAL PRIMARY KEY,
  config_materiel_id INTEGER NOT NULL REFERENCES config_materiel(id),
  numero_serie    TEXT UNIQUE,
  etat            TEXT,
  date_entree     DATE,
  date_sortie     DATE,
  entite_id       INTEGER REFERENCES entites(id),
  sous_entite_id  INTEGER REFERENCES sous_entites(id),
  coordination_id INTEGER REFERENCES coordinations(id),
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS config_munition (
  id              SERIAL PRIMARY KEY,
  code            TEXT UNIQUE,
  designation     TEXT,
  type            TEXT,
  calibre         TEXT,
  seuil_critique  INTEGER DEFAULT 0,
  observation     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS transactions_munitions (
  id              SERIAL PRIMARY KEY,
  config_munition_id INTEGER NOT NULL REFERENCES config_munition(id),
  type_operation  TEXT NOT NULL CHECK (type_operation IN ('ENTREE','SORTIE','DOTATION')),
  quantite        INTEGER NOT NULL CHECK (quantite > 0),
  date_operation  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  code            TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS munitions (
  id              SERIAL PRIMARY KEY,
  config_munition_id INTEGER NOT NULL UNIQUE REFERENCES config_munition(id),
  total_entrees   INTEGER DEFAULT 0,
  total_sorties   INTEGER DEFAULT 0,
  balance         INTEGER DEFAULT 0,
  code            TEXT,
  seuil_critique  INTEGER DEFAULT 0,
  entite_id       INTEGER REFERENCES entites(id),
  sous_entite_id  INTEGER REFERENCES sous_entites(id),
  coordination_id INTEGER REFERENCES coordinations(id),
  region_id       INTEGER REFERENCES regions(id),
  province_id     INTEGER REFERENCES provinces(id),
  commune_id      INTEGER REFERENCES communes(id),
  localite_id     INTEGER REFERENCES localites(id),
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS dotations (
  id              SERIAL PRIMARY KEY,
  vdp_id          INTEGER REFERENCES vdp(id),
  entite_id       INTEGER REFERENCES entites(id),
  ressource_type  TEXT NOT NULL,
  ressource_id    INTEGER NOT NULL,
  code_dotation   TEXT,
  date_dotation   DATE DEFAULT CURRENT_DATE,
  date_integration DATE,
  type_dotation   TEXT NOT NULL,
  statut          TEXT DEFAULT 'active',
  observation     TEXT,
  quantite        INTEGER DEFAULT 0,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE,
  CHECK (
    (vdp_id IS NOT NULL AND entite_id IS NULL) OR
    (vdp_id IS NULL AND entite_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS dotation_history (
  id              SERIAL PRIMARY KEY,
  dotation_id     INTEGER NOT NULL REFERENCES dotations(id),
  action          TEXT NOT NULL,
  old_vdp_id      INTEGER,
  new_vdp_id      INTEGER,
  old_entite_id   INTEGER,
  new_entite_id   INTEGER,
  date_action     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  details         TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS chain_of_custody (
  id              SERIAL PRIMARY KEY,
  ressource_type  TEXT NOT NULL,
  ressource_id    INTEGER NOT NULL,
  holder_type     TEXT NOT NULL,
  holder_id       INTEGER NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ended_at        TIMESTAMPTZ,
  justificatif    TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS roles (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL UNIQUE,
  permissions     TEXT NOT NULL,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role_id         INTEGER NOT NULL REFERENCES roles(id),
  roles           TEXT NOT NULL DEFAULT '[]',
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id         INTEGER NOT NULL REFERENCES utilisateurs(id),
  role_id         INTEGER NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES utilisateurs(id),
  token           TEXT NOT NULL UNIQUE,
  date_debut      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  date_fin        TIMESTAMPTZ,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS notifications (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES utilisateurs(id),
  message         TEXT NOT NULL,
  vue             BOOLEAN DEFAULT FALSE,
  timestamp       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS app_config (
  id              SERIAL PRIMARY KEY,
  nom_param       TEXT NOT NULL UNIQUE,
  valeur          TEXT,
  description     TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES utilisateurs(id),
  table_name      TEXT NOT NULL,
  record_id       INTEGER,
  action          TEXT NOT NULL,
  details         TEXT,
  timestamp       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resource        TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id              SERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  action          TEXT NOT NULL,
  nb_records      INTEGER,
  status          TEXT NOT NULL,
  error_message   TEXT,
  timestamp       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS consommation_munitions (
  id              SERIAL PRIMARY KEY,
  munition_id     INTEGER NOT NULL REFERENCES munitions(id),
  quantite_consommee INTEGER NOT NULL,
  date_consommation DATE DEFAULT CURRENT_DATE,
  remarque        TEXT,
  uuid            UUID DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  synced          BOOLEAN DEFAULT FALSE
);

ALTER TABLE optiques
  ADD COLUMN IF NOT EXISTS entite_id       INTEGER REFERENCES entites(id),
  ADD COLUMN IF NOT EXISTS sous_entite_id  INTEGER REFERENCES sous_entites(id),
  ADD COLUMN IF NOT EXISTS coordination_id INTEGER REFERENCES coordinations(id),
  ADD COLUMN IF NOT EXISTS region_id       INTEGER REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS province_id     INTEGER REFERENCES provinces(id),
  ADD COLUMN IF NOT EXISTS commune_id      INTEGER REFERENCES communes(id),
  ADD COLUMN IF NOT EXISTS localite_id     INTEGER REFERENCES localites(id);

ALTER TABLE materiels_specifiques
  ADD COLUMN IF NOT EXISTS entite_id       INTEGER REFERENCES entites(id),
  ADD COLUMN IF NOT EXISTS sous_entite_id  INTEGER REFERENCES sous_entites(id),
  ADD COLUMN IF NOT EXISTS coordination_id INTEGER REFERENCES coordinations(id),
  ADD COLUMN IF NOT EXISTS region_id       INTEGER REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS province_id     INTEGER REFERENCES provinces(id),
  ADD COLUMN IF NOT EXISTS commune_id      INTEGER REFERENCES communes(id),
  ADD COLUMN IF NOT EXISTS localite_id     INTEGER REFERENCES localites(id);

ALTER TABLE munitions
  ADD COLUMN IF NOT EXISTS entite_id       INTEGER REFERENCES entites(id),
  ADD COLUMN IF NOT EXISTS sous_entite_id  INTEGER REFERENCES sous_entites(id),
  ADD COLUMN IF NOT EXISTS coordination_id INTEGER REFERENCES coordinations(id),
  ADD COLUMN IF NOT EXISTS region_id       INTEGER REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS province_id     INTEGER REFERENCES provinces(id),
  ADD COLUMN IF NOT EXISTS commune_id      INTEGER REFERENCES communes(id),
  ADD COLUMN IF NOT EXISTS localite_id     INTEGER REFERENCES localites(id);

CREATE OR REPLACE FUNCTION set_geo_context()
RETURNS TRIGGER AS $$
DECLARE
  v_entite entites%ROWTYPE;
  v_sous_entite sous_entites%ROWTYPE;
  v_coordination coordinations%ROWTYPE;
BEGIN
  IF NEW.sous_entite_id IS NOT NULL THEN
    SELECT * INTO v_sous_entite FROM sous_entites WHERE id = NEW.sous_entite_id;
    IF FOUND THEN
      NEW.entite_id    := COALESCE(NEW.entite_id, v_sous_entite.entite_id);
      NEW.region_id    := COALESCE(NEW.region_id, v_sous_entite.region_id);
      NEW.province_id  := COALESCE(NEW.province_id, v_sous_entite.province_id);
      NEW.commune_id   := COALESCE(NEW.commune_id, v_sous_entite.commune_id);
      NEW.localite_id  := COALESCE(NEW.localite_id, v_sous_entite.localite_id);
    END IF;
  END IF;

  IF NEW.coordination_id IS NOT NULL THEN
    SELECT * INTO v_coordination FROM coordinations WHERE id = NEW.coordination_id;
    IF FOUND THEN
      NEW.entite_id    := COALESCE(NEW.entite_id, v_coordination.entite_id);
      NEW.region_id    := COALESCE(NEW.region_id, v_coordination.region_id);
      NEW.province_id  := COALESCE(NEW.province_id, v_coordination.province_id);
      NEW.commune_id   := COALESCE(NEW.commune_id, v_coordination.commune_id);
      NEW.localite_id  := COALESCE(NEW.localite_id, v_coordination.localite_id);
    END IF;
  END IF;

  IF NEW.entite_id IS NOT NULL THEN
    SELECT * INTO v_entite FROM entites WHERE id = NEW.entite_id;
    IF FOUND THEN
      NEW.region_id    := COALESCE(NEW.region_id, v_entite.region_id);
      NEW.province_id  := COALESCE(NEW.province_id, v_entite.province_id);
      NEW.commune_id   := COALESCE(NEW.commune_id, v_entite.commune_id);
      NEW.localite_id  := COALESCE(NEW.localite_id, v_entite.localite_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_optiques_geo ON optiques;
CREATE TRIGGER trg_optiques_geo
BEFORE INSERT OR UPDATE ON optiques
FOR EACH ROW EXECUTE FUNCTION set_geo_context();

DROP TRIGGER IF EXISTS trg_materiels_specifiques_geo ON materiels_specifiques;
CREATE TRIGGER trg_materiels_specifiques_geo
BEFORE INSERT OR UPDATE ON materiels_specifiques
FOR EACH ROW EXECUTE FUNCTION set_geo_context();

DROP TRIGGER IF EXISTS trg_munitions_geo ON munitions;
CREATE TRIGGER trg_munitions_geo
BEFORE INSERT OR UPDATE ON munitions
FOR EACH ROW EXECUTE FUNCTION set_geo_context();

CREATE INDEX IF NOT EXISTS idx_armes_entite      ON armes(entite_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dotations_vdp     ON dotations(vdp_id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dotations_entite  ON dotations(entite_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vdp_entite        ON vdp(entite_id)        WHERE deleted_at IS NULL;
