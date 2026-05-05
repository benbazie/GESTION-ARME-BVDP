require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.PG_USER,
    host:     process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port:     process.env.PG_PORT,
});

async function main() {
    await pool.query('TRUNCATE TABLE vdp RESTART IDENTITY CASCADE');
    console.log('🗑️  Table vdp vidée');

    await pool.query("UPDATE sync_checkpoint SET last_page = 0, status = 'pending' WHERE module = 'volontaires'");
    console.log('🔄 Checkpoint remis à zéro');
}

main()
    .catch(e => console.error('❌', e.message))
    .finally(() => pool.end());
