'use strict'

require('dotenv').config()

const fs = require('fs')
const path = require('path')

function getCliArg(name) {
  const prefix = `--${name}=`
  const raw = process.argv.find(a => a.startsWith(prefix))
  return raw ? raw.slice(prefix.length) : null
}

async function main() {
  const dbPath = path.resolve(
    getCliArg('db') || process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'database', 'vdp_manager.db')
  )

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Fichier SQLite introuvable: ${dbPath}`)
    process.exit(1)
  }

  const initSqlJs = require('sql.js')
  const wasmDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')

  const SQL = await initSqlJs({
    locateFile: file => path.join(wasmDir, file),
  })

  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(new Uint8Array(buffer))

  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )

  const tables = (res[0]?.values || []).map(v => String(v[0]))
  console.log(JSON.stringify({ count: tables.length, tables }, null, 2))
}

main().catch(err => {
  console.error('❌ Liste des tables échouée', err)
  process.exit(1)
})
