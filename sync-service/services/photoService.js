const axios = require('axios');
const pool = require('../config/db');
const { getAccessToken } = require('./keycloakService');
const { getCheckpointCursor, saveCheckpointCursor } = require('./checkpointService');

const BASE   = process.env.API_URL;
const MODULE = 'photos';

// URL de la photo : env PHOTO_URL_PATTERN ou fallback standard
// Le pattern doit contenir {id} qui sera remplacé par id_identification
const PHOTO_PATTERN = process.env.PHOTO_URL_PATTERN || '{base}/volontaires/{id}/photo';

function buildPhotoUrl(idIdentification) {
    return PHOTO_PATTERN
        .replace('{base}', BASE)
        .replace('{id}', idIdentification);
}

async function getStoredEtag(idVolontaire) {
    const r = await pool.query(
        'SELECT etag FROM volontaire_photo WHERE id_volontaire = $1',
        [idVolontaire]
    );
    return r.rows[0]?.etag ?? null;
}

async function upsertPhoto(idVolontaire, photoBuffer, etag, lastModified, size) {
    await pool.query(`
        INSERT INTO volontaire_photo (id_volontaire, photo, etag, last_modified, size_bytes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (id_volontaire)
        DO UPDATE SET
            photo         = EXCLUDED.photo,
            etag          = EXCLUDED.etag,
            last_modified = EXCLUDED.last_modified,
            size_bytes    = EXCLUDED.size_bytes,
            updated_at    = NOW()
    `, [idVolontaire, photoBuffer, etag, lastModified, size]);
}

async function syncPhotos() {
    // Reprend depuis le dernier id_identification traité
    const cursor = await getCheckpointCursor(MODULE);
    const cursorNum = cursor ? parseInt(cursor, 10) : 0;

    const { rows: vdps } = await pool.query(
        `SELECT id_identification FROM vdp
         WHERE id_identification IS NOT NULL
           AND id_identification > $1
         ORDER BY id_identification ASC`,
        [cursorNum]
    );

    if (!vdps.length) {
        console.log('📸 Photos — aucun VDP avec id_identification, sync ignorée');
        return;
    }

    console.log(`📸 Photos — ${vdps.length} VDP(s) à vérifier (depuis id=${cursorNum})`);

    let processed = 0;
    let skipped   = 0;
    let errors    = 0;
    let lastId    = cursorNum;

    for (const row of vdps) {
        const idIdent = parseInt(row.id_identification, 10);
        if (isNaN(idIdent)) continue;

        const url = buildPhotoUrl(idIdent);
        const storedEtag = await getStoredEtag(idIdent);

        try {
            const token = await getAccessToken();
            const headers = { Authorization: `Bearer ${token}` };
            if (storedEtag) headers['If-None-Match'] = storedEtag;

            const res = await axios.get(url, {
                headers,
                responseType: 'arraybuffer',
                validateStatus: (s) => s === 200 || s === 304 || s === 404,
            });

            if (res.status === 304) {
                skipped++;
            } else if (res.status === 404) {
                // pas de photo pour ce VDP
                skipped++;
            } else {
                const buf          = Buffer.from(res.data);
                const etag         = res.headers['etag']          ?? '';
                const lastModified = res.headers['last-modified'] ?? new Date().toISOString();
                const size         = parseInt(res.headers['content-length'] ?? '0', 10) || buf.length;
                await upsertPhoto(idIdent, buf, etag, lastModified, size);
                processed++;
            }
        } catch (err) {
            console.warn(`⚠️  Photo ${idIdent} ignorée : ${err.message}`);
            errors++;
        }

        lastId = idIdent;

        // Sauvegarde le curseur tous les 50 VDPs
        if ((processed + skipped + errors) % 50 === 0) {
            await saveCheckpointCursor(MODULE, String(lastId));
        }
    }

    await saveCheckpointCursor(MODULE, String(lastId));
    console.log(`✅ Photos sync OK — ${processed} sauvegardées, ${skipped} inchangées, ${errors} erreurs`);
}

module.exports = { syncPhotos };
