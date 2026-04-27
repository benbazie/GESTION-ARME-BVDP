'use strict'

require('dotenv').config()

const { Pool } = require('pg')

const tableArg = process.argv.find(a => a.startsWith('--table='))
const TABLE = tableArg ? tableArg.split('=')[1] : null

function assertSafeIdentifier(name) {
  if (!name || typeof name !== 'string') throw new Error('Paramètre --table requis')
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Nom de table invalide: ${name}`)
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
  max: Number(process.env.DB_POOL_MAX || 5),
})

async function main() {
  assertSafeIdentifier(TABLE)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1) Communale
    const q1 = await client.query(`
      UPDATE ${TABLE} t
      SET
        coordination_communale_id = cc_pick.id,
        coordination_provinciale_id = cc_pick.parent_id,
        coordination_regionale_id = cp.parent_id
      FROM coordinations c
      JOIN LATERAL (
        SELECT cc.id, cc.parent_id
        FROM coordination_communale cc
        WHERE cc.commune_id = c.commune_id
          AND cc.province_id = c.province_id
          AND cc.region_id = c.region_id
        ORDER BY cc.id ASC
        LIMIT 1
      ) cc_pick ON TRUE
      JOIN coordination_provinciale cp ON cp.id = cc_pick.parent_id
      WHERE t.coordination_id = c.id
        AND c.type = 'communale'
        AND (
          t.coordination_communale_id IS NULL
          OR t.coordination_provinciale_id IS NULL
          OR t.coordination_regionale_id IS NULL
        )
    `)

    // 2) Provincial
    const q2 = await client.query(`
      UPDATE ${TABLE} t
      SET
        coordination_provinciale_id = cp_pick.id,
        coordination_regionale_id = cp_pick.parent_id
      FROM coordinations c
      JOIN LATERAL (
        SELECT cp.id, cp.parent_id
        FROM coordination_provinciale cp
        WHERE cp.province_id = c.province_id
          AND cp.region_id = c.region_id
        ORDER BY cp.id ASC
        LIMIT 1
      ) cp_pick ON TRUE
      WHERE t.coordination_id = c.id
        AND c.type = 'provincial'
        AND (
          t.coordination_provinciale_id IS NULL
          OR t.coordination_regionale_id IS NULL
        )
    `)

    // 3) Regional
    const q3 = await client.query(`
      UPDATE ${TABLE} t
      SET coordination_regionale_id = cr_pick.id
      FROM coordinations c
      JOIN LATERAL (
        SELECT cr.id
        FROM coordination_regionale cr
        WHERE cr.region_id = c.region_id
          AND (cr.entite_id IS NULL OR c.entite_id IS NULL OR cr.entite_id = c.entite_id)
        ORDER BY cr.id ASC
        LIMIT 1
      ) cr_pick ON TRUE
      WHERE t.coordination_id = c.id
        AND c.type = 'regional'
        AND t.coordination_regionale_id IS NULL
    `)

    await client.query('COMMIT')

    console.log(`🎯 Backfill ${TABLE} terminé.`)
    console.log(`- Communale mises à jour : ${q1.rowCount}`)
    console.log(`- Provinciale mises à jour : ${q2.rowCount}`)
    console.log(`- Régionale mises à jour : ${q3.rowCount}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`❌ Backfill ${TABLE} échoué`, err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
