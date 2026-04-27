'use strict'

require('dotenv').config()

const fs   = require('fs')
const path = require('path')
const { Pool } = require('pg')

function getCliArg(name) {
  const prefix = `--${name}=`
  const raw = process.argv.find(a => a.startsWith(prefix))
  return raw ? raw.slice(prefix.length) : null
}

function resolveExistingPath(candidatePaths) {
  for (const candidate of candidatePaths) {
    const absolute = path.resolve(candidate)
    if (fs.existsSync(absolute)) return absolute
  }
  return null
}

const inputCli = getCliArg('input')
const inputEnv = process.env.IMPORT_INPUT_PATH

const INPUT_PATH = resolveExistingPath(
  inputCli
    ? [inputCli]
    : inputEnv
      ? [inputEnv]
      : [
          path.join(__dirname, 'exported_data.json'),
          path.join(__dirname, 'database', 'exported_data.json'),
          path.join(__dirname, 'scripts', 'exported_data.json'),
        ]
)

const CONFLICT_MODE = (getCliArg('conflict') || process.env.IMPORT_CONFLICT || 'skip').toLowerCase()
if (!['skip', 'update', 'error'].includes(CONFLICT_MODE)) {
  console.error(`❌ Valeur invalide pour --conflict (skip|update|error). Reçu: ${CONFLICT_MODE}`)
  process.exit(1)
}

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PG_HOST,
  port: Number(process.env.DB_PORT || process.env.PG_PORT || 5432),
  database:
    process.env.DB_DATABASE ||
    process.env.DB_NAME ||
    process.env.PG_DATABASE ||
    process.env.PG_DB ||
    'gestion_armes',
  user: process.env.DB_USER || process.env.PG_USER,
  password: process.env.DB_PASSWORD || process.env.PG_PASSWORD,
  max: Number(process.env.DB_POOL_MAX || 10)
})

async function resetSequence(client, table) {
  const seqSql = `
    SELECT pg_get_serial_sequence($1, 'id') AS seq
  `
  const { rows } = await client.query(seqSql, [table])
  const seqName = rows[0]?.seq
  if (!seqName) return
  await client.query(
    `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${table}), 0))`,
    [seqName]
  )
}

async function getBaseTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )
  return new Set(rows.map(r => r.table_name))
}

async function getTableColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  )
  return rows.map(r => ({
    name: r.column_name,
    dataType: r.data_type,
    udtName: r.udt_name,
    isNullable: String(r.is_nullable || '').toUpperCase() === 'YES',
    columnDefault: r.column_default
  }))
}

function isTemporalColumn(col) {
  const t = String(col?.dataType || '').toLowerCase()
  const u = String(col?.udtName || '').toLowerCase()

  return (
    t.includes('timestamp') ||
    t === 'date' ||
    u === 'timestamptz' ||
    u === 'timestamp' ||
    u === 'date'
  )
}

function normalizeValueForPg(value, columnMeta) {
  if (value === '') {
    if (isTemporalColumn(columnMeta)) return null
  }
  return value
}

async function main() {
  if (!INPUT_PATH) {
    const attempted = [
      inputCli,
      inputEnv,
      path.join(__dirname, 'exported_data.json'),
      path.join(__dirname, 'database', 'exported_data.json'),
      path.join(__dirname, 'scripts', 'exported_data.json'),
    ].filter(Boolean)

    console.error('❌ Fichier JSON introuvable. Chemins testés:')
    for (const p of attempted) console.error(`   - ${path.resolve(p)}`)
    process.exit(1)
  }

  const PRIORITY = [
    'types_arme',
    'categories_arme',
    'modeles_arme',
    'sources_dotation',
    'sources_armes',
    'lots',
    'etats_position',
    'conditions_techniques',
    'provenance_tactique',
    'config_arme',
    'config_optique',
    'config_materiel',
    'config_munition',
    'regions',
    'provinces',
    'communes',
    'localites',
    'entites',
    'sous_entites',
    'coordination_regionale',
    'coordination_provinciale',
    'coordination_communale',
    'localite_coordination',
    'coordinations',
    'vdp',
    'armes',
    'optiques',
    'materiels_specifiques',
    'munitions',
    'transactions_munitions',
    'dotations',
    'dotation_history',
    'chain_of_custody',
    'consommation_munitions',
    'utilisateurs',
    'roles',
    'user_roles',
    'sessions',
    'notifications',
    'app_config',
    'audit_logs',
    'sync_logs'
  ]

  const priorityIndex = name => {
    const idx = PRIORITY.indexOf(name)
    return idx === -1 ? PRIORITY.length : idx
  }

  const payload = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'))
  const tables  = Object.keys(payload).sort((a, b) => {
    const pa = priorityIndex(a)
    const pb = priorityIndex(b)
    return pa === pb ? a.localeCompare(b) : pa - pb
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const baseTables = await getBaseTables(client)

    for (const table of tables) {
      const rows = payload[table]
      if (!Array.isArray(rows) || rows.length === 0) continue

      if (!baseTables.has(table)) {
        console.warn(`⚠️ Table ignorée (absente ou vue) : ${table}`)
        continue
      }

      const tableColumnsMeta = await getTableColumns(client, table)
      const tableColumns = tableColumnsMeta.map(c => c.name)
      const columnMetaByName = new Map(tableColumnsMeta.map(c => [c.name, c]))

      if (!tableColumns.length) {
        console.warn(`⚠️ Colonnes introuvables pour ${table}, table ignorée`)
        continue
      }

      for (const row of rows) {
        const cols = tableColumns.filter(col => {
          if (!Object.prototype.hasOwnProperty.call(row, col)) return false

          const value = row[col]
          const meta = columnMetaByName.get(col)

          // Si SQLite contient explicitement NULL, mais que la colonne PG est NOT NULL
          // et qu'un DEFAULT existe, on omet la colonne pour laisser PG appliquer le DEFAULT.
          if (value === null && meta && meta.isNullable === false && meta.columnDefault != null) {
            return false
          }

          return true
        })
        if (!cols.length) continue
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ')
        let insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
        if (CONFLICT_MODE !== 'error' && cols.includes('id') && tableColumns.includes('id')) {
          if (CONFLICT_MODE === 'skip') {
            insertSql += ' ON CONFLICT (id) DO NOTHING'
          } else if (CONFLICT_MODE === 'update') {
            const updateCols = cols.filter(c => c !== 'id')
            if (updateCols.length) {
              const setClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')
              insertSql += ` ON CONFLICT (id) DO UPDATE SET ${setClause}`
            } else {
              insertSql += ' ON CONFLICT (id) DO NOTHING'
            }
          }
        }
        const values = cols.map(col => normalizeValueForPg(row[col], columnMetaByName.get(col)))
        await client.query(insertSql, values)
      }

      if (tableColumns.includes('id')) {
        await resetSequence(client, table)
      }
      console.log(`✅ ${rows.length} lignes insérées dans ${table}`)
    }

    await client.query('COMMIT')
    console.log('🎯 Import terminé.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Erreur lors de l’import PostgreSQL', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ Import échoué', err)
  process.exit(1)
})
