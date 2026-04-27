'use strict'

require('dotenv').config()

const fs = require('fs')
const path = require('path')

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

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

async function main() {
  const dbPath = path.resolve(
    getCliArg('db') || process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database', 'vdp_manager.db')
  )

  const outPath = path.resolve(
    getCliArg('out') || process.env.SQLITE_EXPORT_OUT || path.join(__dirname, '..', 'database', 'exported_data.json')
  )

  const requestedTables = parseCsv(getCliArg('tables') || process.env.SQLITE_EXPORT_TABLES)

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Fichier SQLite introuvable: ${dbPath}`)
    process.exit(1)
  }

  const initSqlJs = require('sql.js')

  const wasmDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')
  const SQL = await initSqlJs({
    locateFile: file => path.join(wasmDir, file)
  })

  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(new Uint8Array(buffer))

  const tableRows = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )

  const allTables = (tableRows[0]?.values || []).map(v => String(v[0]))

  const tablesToExport = requestedTables && requestedTables.length
    ? requestedTables.filter(t => allTables.includes(t))
    : allTables

  const missing = requestedTables && requestedTables.length
    ? requestedTables.filter(t => !allTables.includes(t))
    : []

  if (missing.length) {
    console.warn(`⚠️ Tables absentes dans SQLite (ignorées): ${missing.join(', ')}`)
  }

  const payload = {}

  for (const table of tablesToExport) {
    const sql = `SELECT * FROM ${quoteIdent(table)}`
    const res = db.exec(sql)
    if (!res.length) {
      payload[table] = []
      console.log(`✅ 0 lignes exportées depuis ${table}`)
      continue
    }

    const { columns, values } = res[0]
    const rows = values.map(row => {
      const obj = {}
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i]
      }
      return obj
    })

    payload[table] = rows
    console.log(`✅ ${rows.length} lignes exportées depuis ${table}`)
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')

  console.log(`🎯 Export JSON terminé: ${outPath}`)
}

main().catch(err => {
  console.error('❌ Export échoué', err)
  process.exit(1)
})
