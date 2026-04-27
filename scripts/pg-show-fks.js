'use strict'

require('dotenv').config()

const db = require('../database/database')

function parseCsvArg(name) {
  const prefix = `--${name}=`
  const raw = process.argv.find(a => a.startsWith(prefix))
  if (!raw) return null
  return raw
    .slice(prefix.length)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function main() {
  const tables =
    parseCsvArg('tables') ||
    ['chain_of_custody', 'dotation_history', 'dotation_items', 'dotations', 'transactions_munitions', 'mouvements_munitions']

  for (const table of tables) {
    const q = `
      SELECT c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = $1
        AND c.contype = 'f'
      ORDER BY c.conname
    `

    const rows = await db.all(q, [table])
    console.log(`--- ${table} (FKs: ${rows.length})`) 
    for (const r of rows) console.log(`${r.conname} | ${r.def}`)
  }
}

main().catch(err => {
  console.error('❌ Impossible de lister les FK', err)
  process.exit(1)
})
