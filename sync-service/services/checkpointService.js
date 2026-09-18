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
async function getCheckpointCursor(module) {
    const res = await pool.query(
        `SELECT last_cursor FROM sync_checkpoint WHERE module = $1`,
        [module]
    );
    return res.rows[0]?.last_cursor ?? null;
}

async function saveCheckpointCursor(module, cursor) {
    await pool.query(`
        INSERT INTO sync_checkpoint (module, last_page, last_cursor, status, updated_at)
        VALUES ($1, 0, $2, 'in_progress', NOW())
        ON CONFLICT (module)
        DO UPDATE SET
            last_cursor = EXCLUDED.last_cursor,
            status      = 'in_progress',
            updated_at  = NOW()
    `, [module, cursor]);
}

module.exports = {
    getCheckpoint,
    saveCheckpoint,
    getCheckpointCursor,
    saveCheckpointCursor,
};