const pool = require('../config/db')

async function getCheckpoint(module) {
    const res = await pool.query(
        `SELECT * FROM sync_checkpoint WHERE module = $1`,
        [module]
    );

    return res.rows[0];
}
async function saveCheckpoint(module, lastPage, status) {
    await pool.query(`
        INSERT INTO sync_checkpoint (module, last_page, status, updated_at)
        VALUES ($1,$2,$3,NOW())
        ON CONFLICT (module)
        DO UPDATE SET
            last_page = EXCLUDED.last_page,
            status = EXCLUDED.status,
            updated_at = NOW()
    `, [module, lastPage, status]);
}
module.exports = {
    getCheckpoint,
    saveCheckpoint
};