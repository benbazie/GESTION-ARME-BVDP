// database.js
'use strict'

const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const os = require('os')
const dotenv = require('dotenv')
const { createAuditTable } = require('./migrations/audit');

// --- Ajout : chargement d'un .env embarqué si l'application est packagée ---
function loadPackagedDotEnvIfMissing() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    const candidates = [];
    const pushCandidate = (candidate) => {
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    };

    if (process.resourcesPath) {
      pushCandidate(path.join(process.resourcesPath, 'app.asar.unpacked', '.env'));
      pushCandidate(path.join(process.resourcesPath, '.env'));
      pushCandidate(path.join(process.resourcesPath, '..', '.env'));
    }

    const execDir = process.execPath ? path.dirname(process.execPath) : null;
    if (execDir) {
      pushCandidate(path.join(execDir, '.env'));
      pushCandidate(path.join(execDir, '..', '.env'));
    }

    pushCandidate(path.join(process.cwd(), '.env'));
    pushCandidate(path.join(__dirname, '..', '.env'));
    pushCandidate(path.join(__dirname, '.env'));

    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8')
          const parsed = dotenv.parse(content)
          Object.keys(parsed).forEach(k => {
            // n'écrase pas les variables déjà définies (sécurité)
            if (process.env[k] === undefined) process.env[k] = parsed[k]
          })
          console.log(`[db] .env chargé depuis : ${file}`)
          return true
        }
      } catch (e) {
        // ignore and try next
      }
    }
    console.warn('[db] .env introuvable dans les emplacements packagés — certaines variables d\'environnement peuvent manquer (ex: JWT_SECRET).')
  }
  return false
}

// tente de charger si nécessaire (n'affecte pas l'environnement dev)
loadPackagedDotEnvIfMissing()

function genUuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c =>
      (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
    );
}

const mainEntry = (process.mainModule && process.mainModule.filename) || ''
const pkgHints = [
  process.env.FORCE_PACKAGED === '1',
  process.env.PORTABLE_EXECUTABLE_DIR,
  process.env.APPIMAGE,
  (process.resourcesPath && /app\.asar/i.test(process.resourcesPath)),
  (/app\.asar/i.test(mainEntry)),
]
const isPackaged = pkgHints.some(Boolean) && !process.defaultApp

const resolveWritableDir = () => {
  if (process.env.DATABASE_DIR) return process.env.DATABASE_DIR
  if (process.env.GESTION_ARMES_DB_DIR) return process.env.GESTION_ARMES_DB_DIR
  if (isPackaged) {
    const portable = process.env.PORTABLE_EXECUTABLE_DIR
    if (portable) return path.join(portable, 'userdata', 'database')
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'gestion-armes-vdp', 'database')
  }
  return __dirname
}

const writableDir = resolveWritableDir()
let dbPath = process.env.DATABASE_PATH || path.join(writableDir, 'vdp_manager.db')
console.log(`[db] résolution SQLite → ${dbPath} (packaged=${isPackaged})`)

const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.error('[db] Impossible de créer le dossier', dirPath, err.message);
  }
};

const packagedCandidates = [
    process.env.DATABASE_SEEDED_PATH && path.resolve(process.env.DATABASE_SEEDED_PATH),
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'database', 'vdp_manager.db'),
    process.resourcesPath && path.join(process.resourcesPath, 'database', 'vdp_manager.db'),
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar', 'database', 'vdp_manager.db'),
    path.join(__dirname, 'vdp_manager.db'),
  ].filter(Boolean);

console.log('[db] recherche base packagée parmi :', packagedCandidates);

const packagedSource = packagedCandidates.find((candidate) => {
    try {
      return candidate && fs.existsSync(candidate);
    } catch (err) {
      console.warn('[db] test accès base packagée ko :', candidate, err.message);
      return false;
    }
  });

if (isPackaged) {
  const userDataDir = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'gestion-armes-vdp',
    'database'
  );
  ensureDir(userDataDir);

  dbPath = path.join(userDataDir, 'vdp_manager.db');

  if (!fs.existsSync(dbPath)) {
    if (packagedSource) {
      try {
        fs.copyFileSync(packagedSource, dbPath);
        console.log('[db] Copie de la base depuis', packagedSource, 'vers', dbPath);
      } catch (err) {
        console.error('[db] Échec de la copie de la base packagée :', err.message);
      }
    } else {
      console.warn('[db] Base packagée introuvable, création à vide sur', dbPath);
    }
  }
}
ensureDir(path.dirname(dbPath));
try {
  if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, 'a'));
} catch (prepErr) {
  console.error('[db] Préparation du fichier SQLite impossible :', prepErr.message, '=>', dbPath);
}

const SQLITE_FLAGS = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX;

const db = new sqlite3.Database(
  dbPath,
  SQLITE_FLAGS,
  err => {
    if (err) {
      console.error(`[db] Erreur d'ouverture DB (${dbPath}):`, err.message);
      console.error('[db] Vérifiez que le fichier existe et que les permissions sont suffisantes.');
    } else {
      console.log('SQLite connecté:', dbPath);
      db.run("PRAGMA busy_timeout = 5000;")
      db.run("PRAGMA journal_mode = WAL;")
    }
  }
)
db.configure("busyTimeout", 5000)

// --- Ajout : helpers disponibles globalement pour les migrations / triggers ---
// placés ici pour être utilisables depuis des callbacks/stmt exécutés plus tard
function addTouchTrigger(table) {
  try {
    db.run(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_touch
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE ${table}
        SET updated_at = CURRENT_TIMESTAMP,
            synced = 0
        WHERE id = NEW.id;
      END;
    `);
  } catch (e) {
    console.warn(`[db] addTouchTrigger ${table} failed: ${e.message}`);
  }
}

const NON_CONSTANT_DEFAULT_REGEX = /DEFAULT\s+(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|\(CURRENT_TIMESTAMP\)|\(CURRENT_DATE\)|\(CURRENT_TIME\))/i;

function ensureColumn(table, column, definition) {
  try {
    db.all(`PRAGMA table_info(${table});`, (err, rows) => {
      if (err) {
        // table may not exist yet; ignore
        return;
      }
      const exists = Array.isArray(rows) && rows.some(r => r && r.name === column);
      if (exists) return;

      const needsDynamicDefault = NON_CONSTANT_DEFAULT_REGEX.test(definition || '');
      const cleanedDefinition = needsDynamicDefault
        ? (definition || '').replace(NON_CONSTANT_DEFAULT_REGEX, '').replace(/\s+/g, ' ').trim()
        : definition;

      const fallbackDefinition = cleanedDefinition || '';
      const alterSql = `ALTER TABLE ${table} ADD COLUMN ${column} ${fallbackDefinition}`.trim();

      const applyDynamicDefault = () => {
        const defaultMatch = (definition || '').match(NON_CONSTANT_DEFAULT_REGEX);
        if (!defaultMatch) return;
        const defaultExpr = defaultMatch[1].replace(/\(|\)/g, '');
        db.run(
          `UPDATE ${table} SET ${column} = ${defaultExpr} WHERE ${column} IS NULL;`,
          (updateErr) => {
            if (updateErr) {
              console.warn(`[db] default backfill ${table}.${column} failed:`, updateErr.message);
            }
          }
        );
        const triggerName = `trg_${table}_${column}_default`;
        db.run(
          `CREATE TRIGGER IF NOT EXISTS ${triggerName}
            AFTER INSERT ON ${table}
            WHEN NEW.${column} IS NULL
            BEGIN
              UPDATE ${table}
              SET ${column} = ${defaultExpr}
              WHERE id = NEW.id;
            END;`,
          (triggerErr) => {
            if (triggerErr) {
              console.warn(`[db] default trigger ${table}.${column} failed:`, triggerErr.message);
            }
          }
        );
      };

      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${fallbackDefinition}`, (alterErr) => {
        if (alterErr) {
          console.error(`[db] add column ${table}.${column} failed:`, alterErr.message);
          return;
        }
        console.log(`[db] Colonne ajoutée: ${table}.${column} ${definition}`);
        if (needsDynamicDefault) applyDynamicDefault();
      });
    });
  } catch (e) {
    console.warn(`[db] ensureColumn ${table}.${column} threw:`, e.message);
  }
}

function ensureGeoColumns(table) {
  ensureColumn(table, 'entite_id', 'INTEGER REFERENCES entites(id)');
  ensureColumn(table, 'sous_entite_id', 'INTEGER REFERENCES sous_entites(id)');
  ensureColumn(table, 'coordination_id', 'INTEGER REFERENCES coordinations(id)');
  ensureColumn(table, 'region_id', 'INTEGER REFERENCES regions(id)');
  ensureColumn(table, 'province_id', 'INTEGER REFERENCES provinces(id)');
  ensureColumn(table, 'commune_id', 'INTEGER REFERENCES communes(id)');
  ensureColumn(table, 'localite_id', 'INTEGER REFERENCES localites(id)');
}

function ensureCoordinationHierarchyColumns(table) {
  ensureColumn(table, 'coordination_regionale_id', 'INTEGER REFERENCES coordination_regionale(id)');
  ensureColumn(table, 'coordination_provinciale_id', 'INTEGER REFERENCES coordination_provinciale(id)');
  ensureColumn(table, 'coordination_communale_id', 'INTEGER REFERENCES coordination_communale(id)');
}

function installGeoCascadeTrigger(table) {
  try {
    const geoWhen = `WHEN NEW.entite_id IS NULL
        OR NEW.region_id IS NULL
        OR NEW.province_id IS NULL
        OR NEW.commune_id IS NULL
        OR NEW.localite_id IS NULL`;
    const updateSql = `
      UPDATE ${table}
      SET
        entite_id = COALESCE(
          NEW.entite_id,
          entite_id,
          (SELECT entite_id FROM sous_entites WHERE id = NEW.sous_entite_id),
          (SELECT entite_id FROM coordinations WHERE id = NEW.coordination_id)
        ),
        region_id = COALESCE(
          NEW.region_id,
          region_id,
          (SELECT region_id FROM sous_entites WHERE id = NEW.sous_entite_id),
          (SELECT region_id FROM coordinations WHERE id = NEW.coordination_id),
          (SELECT region_id FROM entites WHERE id = COALESCE(
            NEW.entite_id,
            (SELECT entite_id FROM coordinations WHERE id = NEW.coordination_id)
          ))
        ),
        province_id = COALESCE(
          NEW.province_id,
          province_id,
          (SELECT province_id FROM sous_entites WHERE id = NEW.sous_entite_id),
          (SELECT province_id FROM coordinations WHERE id = NEW.coordination_id),
          (SELECT province_id FROM entites WHERE id = COALESCE(
            NEW.entite_id,
            (SELECT entite_id FROM sous_entites WHERE id = NEW.sous_entite_id),
            (SELECT entite_id FROM coordinations WHERE id = NEW.coordination_id)
          ))
        ),
        commune_id = COALESCE(
          NEW.commune_id,
          commune_id,
          (SELECT commune_id FROM sous_entites WHERE id = NEW.sous_entite_id),
          (SELECT commune_id FROM coordinations WHERE id = NEW.coordination_id),
          (SELECT commune_id FROM entites WHERE id = COALESCE(
            NEW.entite_id,
            (SELECT entite_id FROM sous_entites WHERE id = NEW.sous_entite_id),
            (SELECT entite_id FROM coordinations WHERE id = NEW.coordination_id)
          ))
        ),
        localite_id = COALESCE(
          NEW.localite_id,
          localite_id,
          (SELECT localite_id FROM sous_entites WHERE id = NEW.sous_entite_id),
          (SELECT localite_id FROM coordinations WHERE id = NEW.coordination_id),
          (SELECT localite_id FROM entites WHERE id = COALESCE(
            NEW.entite_id,
            (SELECT entite_id FROM sous_entites WHERE id = NEW.sous_entite_id),
            (SELECT entite_id FROM coordinations WHERE id = NEW.coordination_id)
          ))
        )
      WHERE id = NEW.id;
    `;
    db.run(`DROP TRIGGER IF EXISTS trg_${table}_geo_ai;`);
    db.run(`CREATE TRIGGER trg_${table}_geo_ai
      AFTER INSERT ON ${table}
      ${geoWhen}
      BEGIN
        ${updateSql}
      END;
    `);
    db.run(`DROP TRIGGER IF EXISTS trg_${table}_geo_au;`);
    db.run(`CREATE TRIGGER trg_${table}_geo_au
      AFTER UPDATE ON ${table}
      ${geoWhen}
      BEGIN
        ${updateSql}
      END;
    `);
  } catch (e) {
    console.warn(`[db] installGeoCascadeTrigger ${table} failed:`, e.message);
  }
}

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;')

  const SYNC_COLS = `
    uuid TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER DEFAULT 0,
    deleted_at DATETIME
  `

  function fixArmesLotForeignKey() {
    db.get(`PRAGMA table_info(armes)`, (err, cols) => {
      if (err || !Array.isArray(cols)) return;
      const hasSource = cols.some((col) => col.name === 'source_arme_id');
      const hasLegacyLot = cols.some((col) => col.name === 'lot');
      if (hasSource && !hasLegacyLot) return;
      console.log('[db] Migration: armes lot → source_arme_id');
      db.exec(`
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;
        CREATE TABLE armes__shadow AS SELECT * FROM armes;
        DROP TABLE armes;
      `, (dropErr) => {
        if (dropErr) {
          console.error('[db] drop armes pour migration source échoué:', dropErr.message);
          db.exec(`ROLLBACK; PRAGMA foreign_keys=ON;`);
          return;
        }
        db.exec(`
          CREATE TABLE armes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_arme_id INTEGER,
            modele_id INTEGER,
            numero_serie TEXT NOT NULL,
            etat TEXT,
            source_arme_id INTEGER,
            position_id INTEGER NOT NULL DEFAULT 1,
            date_entree DATE,
            date_sortie DATE,
            uuid TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            synced INTEGER DEFAULT 0,
            deleted_at DATETIME,
            entite_id INTEGER,
            type TEXT,
            categorie TEXT,
            statut TEXT,
            ownership_type TEXT DEFAULT 'entite',
            sous_entite_id INTEGER,
            region_id INTEGER,
            province_id INTEGER,
            commune_id INTEGER,
            localite_id INTEGER,
            coordination_id INTEGER,
            sous_coordination_id INTEGER,
            created_by INTEGER,
            created_by_name TEXT,
            updated_by INTEGER,
            updated_by_name TEXT,
            deleted_by INTEGER,
            deleted_by_name TEXT,
            deleted INTEGER DEFAULT 0,
            designation TEXT,
            mobilite TEXT DEFAULT 'normale',
            position TEXT DEFAULT '',
            calibre TEXT,
            annee_fabrication TEXT,
            marque TEXT,
            modele TEXT,
            pays_origine TEXT,
            FOREIGN KEY(config_arme_id)  REFERENCES config_arme(id),
            FOREIGN KEY(modele_id)       REFERENCES modeles_arme(id),
            FOREIGN KEY(source_arme_id)  REFERENCES sources_armes(id) ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY(position_id)     REFERENCES etats_position(id),
            FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
            FOREIGN KEY(sous_coordination_id) REFERENCES coordinations(id)
          );
          INSERT INTO armes (
            id, config_arme_id, modele_id, numero_serie, etat, source_arme_id,
            position_id, date_entree, date_sortie, uuid, updated_at, synced, deleted_at,
            entite_id, type, categorie, statut, ownership_type,
            sous_entite_id, region_id, province_id, commune_id, localite_id,
            coordination_id, sous_coordination_id, created_by, created_by_name, updated_by,
            updated_by_name, deleted_by, deleted_by_name, deleted, designation, mobilite,
            position, calibre, annee_fabrication, marque, modele, pays_origine
          )
          SELECT
            id, config_arme_id, modele_id, numero_serie, etat, lot,
            position_id, date_entree, date_sortie, uuid, updated_at, synced, deleted_at,
            entite_id, type, categorie, statut, ownership_type,
            sous_entite_id, region_id, province_id, commune_id, localite_id,
            coordination_id, sous_coordination_id, created_by, created_by_name, updated_by,
            updated_by_name, deleted_by, deleted_by_name, deleted, designation, mobilite,
            position, calibre, annee_fabrication, marque, modele, pays_origine
          FROM armes__shadow;
          DROP TABLE armes__shadow;
          COMMIT;
          PRAGMA foreign_keys=ON;
        `, (migrateErr) => {
          if (migrateErr) {
            console.error('[db] Migration armes source échouée:', migrateErr.message);
            db.exec(`ROLLBACK; PRAGMA foreign_keys=ON;`);
            return;
          }
          addTouchTrigger('armes');
          db.run(`DROP INDEX IF EXISTS ux_armes_num;`);
          db.run(`CREATE INDEX IF NOT EXISTS ix_armes_numero_serie ON armes(numero_serie);`);
        });
      });
    });
  }

  function migrateLotsToSourcesArmes() {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='lots'`, (err, lotsTable) => {
      if (err || !lotsTable) return;
      db.all(`PRAGMA table_info(lots);`, (metaErr, columns = []) => {
        if (metaErr) return;
        const hasSourceId = columns.some((col) => col.name === 'source_id');
        const sourceColumn = hasSourceId ? 'source_id' : 'NULL';
        console.log('[db] Migration lots → sources_armes (source_id présent =', hasSourceId, ')');
        db.serialize(() => {
          db.run(`
            INSERT OR IGNORE INTO sources_armes (
              id, code, nom, description, provenance, source_dotation_id,
              date_reception, date_cloture, uuid, updated_at, synced, deleted_at
            )
            SELECT
              id, NULL, designation, description, NULL, ${sourceColumn},
              periode_debut, periode_fin, uuid, updated_at, synced, deleted_at
            FROM lots;
          `, (insertErr) => {
            if (insertErr) {
              console.error('[db] copie lots → sources_armes échouée:', insertErr.message);
              return;
            }
            db.run(`DROP TABLE lots;`, (dropErr) => {
              if (dropErr) console.error('[db] suppression table lots échouée:', dropErr.message);
            });
          });
        });
      });
    });
  }

  // 1. Localisation
  db.run(`
    CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS provinces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      region_id INTEGER NOT NULL,
      ${SYNC_COLS},
      FOREIGN KEY(region_id) REFERENCES regions(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS communes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      province_id INTEGER NOT NULL,
      region_id INTEGER NOT NULL,
      ${SYNC_COLS},
      FOREIGN KEY(province_id) REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(region_id)   REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `)
  ensureColumn('communes', 'region_id', 'INTEGER')

  db.run(`
    CREATE TABLE IF NOT EXISTS localites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      province_id INTEGER NOT NULL,
      region_id INTEGER NOT NULL,
      commune_id INTEGER NOT NULL,
      ${SYNC_COLS},
      FOREIGN KEY(province_id) REFERENCES provinces(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(region_id)   REFERENCES regions(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(commune_id)  REFERENCES communes(id)   ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `)
  ensureColumn('localites', 'region_id', 'INTEGER REFERENCES regions(id)');
  ensureColumn('localites', 'province_id', 'INTEGER REFERENCES provinces(id)');
  ensureColumn('localites', 'commune_id', 'INTEGER REFERENCES communes(id)');

  // 2. Organisation
  db.run(`
    CREATE TABLE IF NOT EXISTS entites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      date_creation DATE DEFAULT (date('now')),
      ${SYNC_COLS},
      FOREIGN KEY(region_id)   REFERENCES regions(id),
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(commune_id)  REFERENCES communes(id),
      FOREIGN KEY(localite_id) REFERENCES localites(id)
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sous_entites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entite_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      date_creation DATE DEFAULT (date('now')),
      ${SYNC_COLS},
      FOREIGN KEY(entite_id)   REFERENCES entites(id),
      FOREIGN KEY(region_id)   REFERENCES regions(id),
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(commune_id)  REFERENCES communes(id),
      FOREIGN KEY(localite_id) REFERENCES localites(id)
    );
  `)

  
  // --- COORDINATIONS HIÉRARCHIQUES ---
  db.run(`
    CREATE TABLE IF NOT EXISTS coordination_regionale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      entite_id INTEGER,
      region_id INTEGER NOT NULL,
      description TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(entite_id) REFERENCES entites(id),
      FOREIGN KEY(region_id) REFERENCES regions(id)
    );
  `);
  // Ajoute ou corrige la colonne code pour qu'elle soit NOT NULL DEFAULT ''
  ensureColumn('coordination_regionale', 'code', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('coordination_regionale', 'entite_id', 'INTEGER');
  ensureColumn('coordination_regionale', 'region_id', 'INTEGER');

  db.run(`
    CREATE TABLE IF NOT EXISTS coordination_provinciale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      province_id INTEGER NOT NULL,
      region_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      description TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(region_id) REFERENCES regions(id),
      FOREIGN KEY(parent_id) REFERENCES coordination_regionale(id)
    );
  `);
  // Ajoute ou corrige la colonne code pour qu'elle soit NOT NULL DEFAULT ''
  ensureColumn('coordination_provinciale', 'code', "TEXT NOT NULL DEFAULT ''");

  db.run(`
    CREATE TABLE IF NOT EXISTS coordination_communale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT,
      commune_id INTEGER NOT NULL,
      province_id INTEGER NOT NULL,
      region_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      description TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(commune_id) REFERENCES communes(id),
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(region_id) REFERENCES regions(id),
      FOREIGN KEY(parent_id) REFERENCES coordination_provinciale(id)
    );
  `);
  // Ajoute ou corrige la colonne code pour qu'elle soit NOT NULL DEFAULT ''
  ensureColumn('coordination_communale', 'code', "TEXT NOT NULL DEFAULT ''");

  db.run(`
    CREATE TABLE IF NOT EXISTS localite_coordination (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      localite_id INTEGER NOT NULL,
      coordination_commune_id INTEGER NOT NULL,
      ${SYNC_COLS},
      FOREIGN KEY(localite_id) REFERENCES localites(id),
      FOREIGN KEY(coordination_commune_id) REFERENCES coordination_communale(id)
    );
  `);

  // 3. VDP
  // CONTRAINTE TRIGGER CNIB A 17 CHIFFRES  .CONTRAINTE NON NULL 
  db.run(`
    CREATE TABLE IF NOT EXISTS vdp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance DATE,
      lieu_naissance TEXT,
      sexe TEXT,
      numero_cnib TEXT,  
      date_cnib DATE,
      date_recrutement DATE,
      statut_vdp TEXT,
      statut_matrimonial TEXT,
      nb_enfants INTEGER,
      entite_id INTEGER,
      sous_entite_id INTEGER,
      coordination_id INTEGER,
      coordination_regionale_id INTEGER,
      coordination_provinciale_id INTEGER,
      coordination_communale_id INTEGER,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      type_vdp TEXT,
      contacts TEXT,
      photo BLOB,
      observation TEXT,
      code_qr TEXT,
      contact_urgence1 TEXT NOT NULL,
      contact_urgence2 TEXT,
      contact_urgence3 TEXT,
      nom_personne_prevenir TEXT,
      lien_personne_prevenir TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(entite_id)       REFERENCES entites(id),
      FOREIGN KEY(sous_entite_id)  REFERENCES sous_entites(id),
      FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
      FOREIGN KEY(region_id)       REFERENCES regions(id),
      FOREIGN KEY(province_id)     REFERENCES provinces(id),
      FOREIGN KEY(commune_id)      REFERENCES communes(id),
      FOREIGN KEY(localite_id)     REFERENCES localites(id)
    );
  `);
  ensureGeoColumns('vdp')
  ensureCoordinationHierarchyColumns('vdp')

  // 4. Classifications ARMES
  db.run(`
    CREATE TABLE IF NOT EXISTS types_arme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      description TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS categories_arme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      code TEXT,
      description TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(type_id) REFERENCES types_arme(id)
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS modeles_arme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      type_id INTEGER,
      categorie_id INTEGER,
      uuid TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      deleted_at DATETIME,
      FOREIGN KEY(type_id) REFERENCES types_arme(id),
      FOREIGN KEY(categorie_id) REFERENCES categories_arme(id)
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS config_arme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      designation TEXT,
      type_id INTEGER,
      categorie_id INTEGER,
      modele_id INTEGER,
      observation TEXT,
      uuid TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      deleted_at DATETIME,
      FOREIGN KEY(type_id) REFERENCES types_arme(id),
      FOREIGN KEY(categorie_id) REFERENCES categories_arme(id),
      FOREIGN KEY(modele_id) REFERENCES modeles_arme(id)
    );
  `);
  ensureColumn('config_arme', 'type_id', 'INTEGER REFERENCES types_arme(id)');
  ensureColumn('config_arme', 'categorie_id', 'INTEGER REFERENCES categories_arme(id)');
  ensureColumn('config_arme', 'modele_id', 'INTEGER REFERENCES modeles_arme(id)');
  ensureColumn('config_arme', 'modele_nom', 'TEXT');

  // 5. Sources & Lots
  db.run(`
    CREATE TABLE IF NOT EXISTS sources_dotation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      details TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sources_armes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      nom TEXT NOT NULL,
      description TEXT,
      provenance TEXT,
      source_dotation_id INTEGER,
      date_reception TEXT,
      date_cloture TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS armes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_arme_id INTEGER,
      modele_id INTEGER,
      numero_serie TEXT NOT NULL,
      etat TEXT,
      source_arme_id INTEGER,
      position_id INTEGER NOT NULL DEFAULT 1,
      date_entree DATE,
      date_sortie DATE,
      uuid TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      deleted_at DATETIME,
      entite_id INTEGER,
      type TEXT,
      categorie TEXT,
      statut TEXT,
      ownership_type TEXT DEFAULT 'entite',
      sous_entite_id INTEGER,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      coordination_id INTEGER,
      sous_coordination_id INTEGER,
      coordination_regionale_id INTEGER,
      coordination_provinciale_id INTEGER,
      coordination_communale_id INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      updated_by INTEGER,
      updated_by_name TEXT,
      deleted_by INTEGER,
      deleted_by_name TEXT,
      deleted INTEGER DEFAULT 0,
      designation TEXT,
      mobilite TEXT DEFAULT 'normale',
      position TEXT DEFAULT '',
      calibre TEXT,
      annee_fabrication TEXT,
      marque TEXT,
      modele TEXT,
      pays_origine TEXT,
      FOREIGN KEY(config_arme_id)  REFERENCES config_arme(id),
      FOREIGN KEY(modele_id)       REFERENCES modeles_arme(id),
      FOREIGN KEY(source_arme_id)  REFERENCES sources_armes(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY(position_id)     REFERENCES etats_position(id),
      FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
      FOREIGN KEY(sous_coordination_id) REFERENCES coordinations(id)
    );
  `, () => {
    db.run(`DROP INDEX IF EXISTS ux_armes_num;`);
    db.run(`CREATE INDEX IF NOT EXISTS ix_armes_numero_serie ON armes(numero_serie);`);
  })
  ensureCoordinationHierarchyColumns('armes')

  // 7. Optiques
  db.run(`
    CREATE TABLE IF NOT EXISTS config_optique (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      designation TEXT,
      type TEXT,
      categorie TEXT,
      grossissement TEXT,
      observation TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS optiques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_optique_id INTEGER NOT NULL,
      numero_serie TEXT,
      etat TEXT,
      date_entree DATE,
      date_sortie DATE,
      entite_id INTEGER,
      sous_entite_id INTEGER,
      coordination_id INTEGER,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      observation TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(config_optique_id) REFERENCES config_optique(id),
      FOREIGN KEY(entite_id) REFERENCES entites(id),
      FOREIGN KEY(sous_entite_id) REFERENCES sous_entites(id),
      FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
      FOREIGN KEY(region_id) REFERENCES regions(id),
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(commune_id) REFERENCES communes(id),
      FOREIGN KEY(localite_id) REFERENCES localites(id)
    );
  `)
  ensureCoordinationHierarchyColumns('optiques')

  // 8. Matériels spécifiques
  db.run(`
    CREATE TABLE IF NOT EXISTS config_materiel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      designation TEXT,
      type TEXT,
      categorie TEXT,
      observation TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS materiels_specifiques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_materiel_id INTEGER NOT NULL,
      numero_serie TEXT,
      etat TEXT,
      date_entree DATE,
      date_sortie DATE,
      entite_id INTEGER,
      sous_entite_id INTEGER,
      coordination_id INTEGER,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      observation TEXT,
      ${SYNC_COLS},
      FOREIGN KEY(config_materiel_id) REFERENCES config_materiel(id),
      FOREIGN KEY(entite_id) REFERENCES entites(id),
      FOREIGN KEY(sous_entite_id) REFERENCES sous_entites(id),
      FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
      FOREIGN KEY(region_id) REFERENCES regions(id),
      FOREIGN KEY(province_id) REFERENCES provinces(id),
      FOREIGN KEY(commune_id) REFERENCES communes(id),
      FOREIGN KEY(localite_id) REFERENCES localites(id)
    );
  `)
  ensureCoordinationHierarchyColumns('materiels_specifiques')

  // 5. Sources & Lots
  db.run(`
    CREATE TABLE IF NOT EXISTS sources_dotation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      details TEXT,
      ${SYNC_COLS}
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sources_armes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      nom TEXT NOT NULL,
      description TEXT,
      provenance TEXT,
      source_dotation_id INTEGER,
      date_reception TEXT,
      date_cloture TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS armes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_arme_id INTEGER,
      modele_id INTEGER,
      numero_serie TEXT NOT NULL,
      etat TEXT,
      source_arme_id INTEGER,
      position_id INTEGER NOT NULL DEFAULT 1,
      date_entree DATE,
      date_sortie DATE,
      uuid TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      deleted_at DATETIME,
      entite_id INTEGER,
      type TEXT,
      categorie TEXT,
      statut TEXT,
      ownership_type TEXT DEFAULT 'entite',
      sous_entite_id INTEGER,
      region_id INTEGER,
      province_id INTEGER,
      commune_id INTEGER,
      localite_id INTEGER,
      coordination_id INTEGER,
      sous_coordination_id INTEGER,
      coordination_regionale_id INTEGER,
      coordination_provinciale_id INTEGER,
      coordination_communale_id INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      updated_by INTEGER,
      updated_by_name TEXT,
      deleted_by INTEGER,
      deleted_by_name TEXT,
      deleted INTEGER DEFAULT 0,
      designation TEXT,
      mobilite TEXT DEFAULT 'normale',
      position TEXT DEFAULT '',
      calibre TEXT,
      annee_fabrication TEXT,
      marque TEXT,
      modele TEXT,
      pays_origine TEXT,
      FOREIGN KEY(config_arme_id)  REFERENCES config_arme(id),
      FOREIGN KEY(modele_id)       REFERENCES modeles_arme(id),
      FOREIGN KEY(source_arme_id)  REFERENCES sources_armes(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY(position_id)     REFERENCES etats_position(id),
      FOREIGN KEY(coordination_id) REFERENCES coordinations(id),
      FOREIGN KEY(sous_coordination_id) REFERENCES coordinations(id)
    );
  `, () => {
    db.run(`DROP INDEX IF EXISTS ux_armes_num;`);
    db.run(`CREATE INDEX IF NOT EXISTS ix_armes_numero_serie ON armes(numero_serie);`);
  })
  ensureCoordinationHierarchyColumns('armes')

  // 6. Dotations
  db.run(`
    CREATE TABLE IF NOT EXISTS dotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      dotation_type TEXT DEFAULT 'individuelle',
      beneficiary_type TEXT DEFAULT 'vdp',
      vdp_id INTEGER,
      entite_id INTEGER,
      sous_entite_id INTEGER,
      coordination_id INTEGER,
      source_id INTEGER,
      statut TEXT DEFAULT 'en_cours',
      date_dotation DATE,
      date_prevue_retour DATE,
      date_cloture DATE,
      observation TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      deleted_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      synced INTEGER DEFAULT 0,
      uuid TEXT
    );
  `, () => {
    // ...existing code...
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS dotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dotation_id INTEGER NOT NULL,
      arme_id INTEGER,
      resource_type TEXT DEFAULT 'arme',
      resource_id INTEGER,
      quantite INTEGER DEFAULT 1,
      status TEXT DEFAULT 'assigné',
      condition_initiale TEXT,
      condition_retour TEXT,
      returned_at DATETIME,
      returned_by INTEGER,
      created_by INTEGER,
      updated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      deleted_at DATETIME,
      FOREIGN KEY(dotation_id) REFERENCES dotations(id) ON DELETE CASCADE,
      FOREIGN KEY(arme_id) REFERENCES armes(id),
      FOREIGN KEY(resource_id) REFERENCES armes(id)
    );
  `, () => {
    // ...existing code...
  });

  // Trigger : propager la localisation de l'arme vers le VDP lors d'une dotation
  db.run(`DROP TRIGGER IF EXISTS trg_dotation_propagate_geo_to_vdp;`);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_dotation_propagate_geo_to_vdp
    AFTER INSERT ON dotation_items
    FOR EACH ROW
    WHEN NEW.resource_type = 'arme' AND NEW.resource_id IS NOT NULL
    BEGIN
      UPDATE vdp
      SET
        region_id = COALESCE(
          (SELECT region_id FROM armes WHERE id = NEW.resource_id),
          vdp.region_id
        ),
        province_id = COALESCE(
          (SELECT province_id FROM armes WHERE id = NEW.resource_id),
          vdp.province_id
        ),
        commune_id = COALESCE(
          (SELECT commune_id FROM armes WHERE id = NEW.resource_id),
          vdp.commune_id
        ),
        localite_id = COALESCE(
          (SELECT localite_id FROM armes WHERE id = NEW.resource_id),
          vdp.localite_id
        ),
        coordination_regionale_id = COALESCE(
          (SELECT coordination_regionale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_regionale_id
        ),
        coordination_provinciale_id = COALESCE(
          (SELECT coordination_provinciale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_provinciale_id
        ),
        coordination_communale_id = COALESCE(
          (SELECT coordination_communale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_communale_id
        ),
        entite_id = COALESCE(
          (SELECT entite_id FROM armes WHERE id = NEW.resource_id),
          vdp.entite_id
        ),
        sous_entite_id = COALESCE(
          (SELECT sous_entite_id FROM armes WHERE id = NEW.resource_id),
          vdp.sous_entite_id
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE vdp.id = (SELECT vdp_id FROM dotations WHERE id = NEW.dotation_id);
    END;
  `);

  // Trigger : propager également lors de la mise à jour d'un item existant
  db.run(`DROP TRIGGER IF EXISTS trg_dotation_propagate_geo_to_vdp_update;`);
  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_dotation_propagate_geo_to_vdp_update
    AFTER UPDATE ON dotation_items
    FOR EACH ROW
    WHEN NEW.resource_type = 'arme' AND NEW.resource_id IS NOT NULL
    BEGIN
      UPDATE vdp
      SET
        region_id = COALESCE(
          (SELECT region_id FROM armes WHERE id = NEW.resource_id),
          vdp.region_id
        ),
        province_id = COALESCE(
          (SELECT province_id FROM armes WHERE id = NEW.resource_id),
          vdp.province_id
        ),
        commune_id = COALESCE(
          (SELECT commune_id FROM armes WHERE id = NEW.resource_id),
          vdp.commune_id
        ),
        localite_id = COALESCE(
          (SELECT localite_id FROM armes WHERE id = NEW.resource_id),
          vdp.localite_id
        ),
        coordination_regionale_id = COALESCE(
          (SELECT coordination_regionale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_regionale_id
        ),
        coordination_provinciale_id = COALESCE(
          (SELECT coordination_provinciale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_provinciale_id
        ),
        coordination_communale_id = COALESCE(
          (SELECT coordination_communale_id FROM armes WHERE id = NEW.resource_id),
          vdp.coordination_communale_id
        ),
        entite_id = COALESCE(
          (SELECT entite_id FROM armes WHERE id = NEW.resource_id),
          vdp.entite_id
        ),
        sous_entite_id = COALESCE(
          (SELECT sous_entite_id FROM armes WHERE id = NEW.resource_id),
          vdp.sous_entite_id
        ),
        updated_at = CURRENT_TIMESTAMP
      WHERE vdp.id = (SELECT vdp_id FROM dotations WHERE id = NEW.dotation_id);
    END;
  `);

  // Ajout des colonnes de géolocalisation
  ensureColumn('regions', 'latitude', 'REAL');
  ensureColumn('regions', 'longitude', 'REAL');
  ensureColumn('provinces', 'latitude', 'REAL');
  ensureColumn('provinces', 'longitude', 'REAL');
  ensureColumn('communes', 'latitude', 'REAL');
  ensureColumn('communes', 'longitude', 'REAL');
  ensureColumn('localites', 'latitude', 'REAL');
  ensureColumn('localites', 'longitude', 'REAL');

  migrateLotsToSourcesArmes();
  fixArmesLotForeignKey()

}); // <-- Ajoute la fermeture de db.serialize ici

const buildExport = (database) => {
  const wrapper = { db: database };
  ['run', 'get', 'all', 'prepare', 'each', 'serialize', 'parallelize', 'close'].forEach((method) => {
    if (typeof database[method] === 'function') {
      wrapper[method] = database[method].bind(database);
    }
  });
  return wrapper;
};

module.exports =
module.exports.default = module.exports;

// Corrige la fonction listRoutes pour éviter l'erreur si app._router ou app._router.stack est undefined
function listRoutes() {
  try {
    console.log('--- Mounted routes ---')
    // Cherche l'objet app Express dans le scope global ou local
    let expressApp = null;
    if (typeof app !== "undefined" && app && app._router && Array.isArray(app._router.stack)) {
      expressApp = app;
    } else if (typeof global !== "undefined" && global.app && global.app._router && Array.isArray(global.app._router.stack)) {
      expressApp = global.app;
    }
    if (!expressApp) {
      console.log('(Pas de stack de routes Express trouvée)');
      return;
    }
    const stack = expressApp._router.stack;
    stack.forEach(m => {
      if (m.route && m.route.path) {
        const methods = Object.keys(m.route.methods).join(',').toUpperCase()
        console.log(methods, m.route.path)
      } else if (m.name === 'router' && m.handle && Array.isArray(m.handle.stack)) {
        m.handle.stack.forEach(r => {
          if (r.route) {
            const methods = Object.keys(r.route.methods).join(',').toUpperCase()
            console.log(methods, r.route.path)
          }
        })
      }
    })
    console.log('----------------------')
  } catch (e) {
    console.warn('Impossible de lister les routes:', e.message)
  }
}

function permsFor(tables, actions) {
  const tableList = Array.isArray(tables) ? tables : [tables];
  const actionList = Array.isArray(actions) ? actions : [actions];
  const permissions = new Set();
  tableList.filter(Boolean).forEach(table => {
    actionList.filter(Boolean).forEach(action => {
      permissions.add(`${table}_${action}`);
    });
  });
  return Array.from(permissions);
}

const RESOURCE_TABLES = [
  'armes','optiques','materiels_specifiques','munitions',
  'dotations','transactions_munitions','mouvements_munitions',
  'alertes_munitions','chain_of_custody','lots','consommation_munitions','vdp',
  'sources_armes'
];

const GEO_TABLES = [
  'regions','provinces','communes','localites',
  'entites','sous_entites','coordinations',
  'coordination_regionale','coordination_provinciale','coordination_communale',
  'localite_coordination'
];

const DEFAULT_ROLES = [
  {
    nom: 'role_admin',
    permissions: [
      ...permsFor(
        [...RESOURCE_TABLES, ...GEO_TABLES, 'utilisateurs','roles','sessions','notifications','app_config','audit_logs','sync_logs'],
        ['read','create','update','delete','manage']
      ),
      ...permsFor(['sessions','notifications'], ['read','delete']),
      'app_config_read',
      'module_systeme',
      'module_configurations',
      'module_localisation',
      'module_entites',
      'module_coordinations',
      'module_ddr',
      'module_suivi'
    ]
  },
  {
    nom: 'gestionnaire_cartographie',
    permissions: permsFor(GEO_TABLES, ['read','create','update','delete'])
  },
  {
    nom: 'auditeur',
    permissions: permsFor(
      [...RESOURCE_TABLES, ...GEO_TABLES, 'utilisateurs','roles','sessions','notifications','app_config','audit_logs','sync_logs'],
      ['read']
    )
  }
];

  // Remplacement : ensureDefaultRoles plus robuste
  function ensureDefaultRoles() {
    try {
      if (!Array.isArray(DEFAULT_ROLES) || DEFAULT_ROLES.length === 0) return;
      DEFAULT_ROLES.forEach((role) => {
        try {
          db.get('SELECT id FROM roles WHERE nom = ?', [role.nom], (dbErr, row) => {
            try {
              if (dbErr) {
                console.error('[roles] SELECT error for', role.nom, dbErr && dbErr.message);
                return;
              }
              if (row) return;
              db.run(
                'INSERT INTO roles (nom, permissions) VALUES (?, ?)',
                [role.nom, JSON.stringify(role.permissions || [])],
                (insertErr) => {
                  if (insertErr) console.error('[roles] insert default', insertErr.message);
                }
              );
            } catch (cbErr) {
              console.error('[roles] ensureDefaultRoles callback error for', role.nom, cbErr && cbErr.message);
            }
          });
        } catch (itErr) {
          console.error('[roles] ensureDefaultRoles iteration error for', role && role.nom, itErr && itErr.message);
        }
      });
    } catch (e) {
      console.error('[roles] ensureDefaultRoles fatal:', e && e.message);
    }
  }

  function ensureAdminRoleBinding() {
    db.get('SELECT id FROM roles WHERE nom = ?', ['admin'], (err, row) => {
      if (err) {
        console.error('[roles] SELECT error for admin role:', err.message);
        return;
      }
      if (!row) {
        db.run(
          'INSERT INTO roles (nom, permissions) VALUES (?, ?)',
          ['admin', JSON.stringify(['*'])],
          (insertErr) => {
            if (insertErr) console.error('[roles] insert admin role error:', insertErr.message);
            else console.log('[roles] admin role créé avec succès.');
          }
        );
      } else {
        console.log('[roles] Le rôle admin existe déjà.');
      }
    });
  }

  ensureDefaultRoles();
  ensureAdminRoleBinding();

  function grantAllPermissionsToRole(roleName) {
    db.run(
      'UPDATE roles SET permissions = ? WHERE nom = ?',
      [JSON.stringify(['*']), roleName],
      (err) => {
        if (err) console.error(`[db] Impossible d’accorder tous les droits à ${roleName}:`, err.message);
        else console.log(`[db] Tous les droits accordés au rôle ${roleName}.`);
      }
    );
  }

  ensureColumn('utilisateurs', 'nom', 'TEXT');
  ensureColumn('utilisateurs', 'prenom', 'TEXT');
  ensureColumn('utilisateurs', 'grade', 'TEXT');
  ensureColumn('utilisateurs', 'contact', 'TEXT');
  ensureColumn('utilisateurs', 'email', 'TEXT');
  ensureColumn('utilisateurs', 'entite_id', 'INTEGER REFERENCES entites(id)');
  ensureColumn('utilisateurs', 'sous_entite_id', 'INTEGER REFERENCES sous_entites(id)');
  ensureColumn('utilisateurs', 'coordination_regionale_id', 'INTEGER REFERENCES coordination_regionale(id)');
  ensureColumn('utilisateurs', 'coordination_provinciale_id', 'INTEGER REFERENCES coordination_provinciale(id)');
  ensureColumn('utilisateurs', 'coordination_communale_id', 'INTEGER REFERENCES coordination_communale(id)');
  ensureColumn('utilisateurs', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('utilisateurs', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
