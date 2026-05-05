require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.PG_USER,
    host:     process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port:     process.env.PG_PORT,
});

pool.query("UPDATE sync_checkpoint SET last_page = 0 WHERE module = 'volontaires'")
    .then(r => { console.log(`✅ Checkpoint remis à 0 (${r.rowCount} ligne mise à jour)`); })
    .catch(e => { console.error('❌', e.message); })
    .finally(() => pool.end());
