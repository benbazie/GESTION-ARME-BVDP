'use strict'

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

function getCliArg(name) {
  const prefix = `--${name}=`
  const raw = process.argv.find(a => a.startsWith(prefix))
  return raw ? raw.slice(prefix.length) : null
}

function parseCsv(value) {
  if (!value) return null
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

const OUT_PATH = path.resolve(getCliArg('out') || process.env.EXPORT_OUT_PATH || path.join(__dirname, '..', 'exported_data.json'))
const TABLES = parseCsv(getCliArg('tables') || process.env.EXPORT_TABLES)

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
  max: Number(process.env.DB_POOL_MAX || 5)
})

async function getBaseTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  )
  return rows.map(r => r.table_name)
}

async function exportTable(client, table) {
  const { rows } = await client.query(`SELECT * FROM ${table}`)
  return rows
}

async function main() {
  const client = await pool.connect()
  try {
    const tables = TABLES && TABLES.length ? TABLES : await getBaseTables(client)

    const payload = {}
    for (const table of tables) {
      try {
        const rows = await exportTable(client, table)
        payload[table] = rows
        console.log(`✅ ${rows.length} lignes exportées depuis ${table}`)
      } catch (err) {
        console.warn(`⚠️ Export ignoré pour ${table}: ${err.message}`)
      }
    }

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
    console.log(`🎯 Export terminé: ${OUT_PATH}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ Export échoué', err)
  process.exit(1)
})
