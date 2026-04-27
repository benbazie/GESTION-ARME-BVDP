// db.js
require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      10,
  idleTimeoutMillis: 30000
})

module.exports = {
  query:   (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
}
