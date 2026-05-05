const axios = require('axios');
const pool = require('../config/db');

const BASE = process.env.API_URL;

async function syncRegions(token) {
    const res = await axios.get(`${BASE}/regions`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    for (const r of res.data) {
        const code = String(r.idRegion);
        const existing = await pool.query('SELECT id FROM regions WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE regions SET nom = $1, synced = true WHERE code = $2',
                [r.nomRegion, code]
            );
        } else {
            await pool.query(
                'INSERT INTO regions (nom, code, synced) VALUES ($1, $2, true)',
                [r.nomRegion, code]
            );
        }
    }
}

async function syncProvinces(token) {
    const res = await axios.get(`${BASE}/provinces`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    for (const p of res.data) {
        const code = String(p.idProvince);
        const regionRow = await pool.query(
            'SELECT id FROM regions WHERE code = $1',
            [String(p.idRegion)]
        );
        if (!regionRow.rows[0]) continue;
        const regionId = regionRow.rows[0].id;

        const existing = await pool.query('SELECT id FROM provinces WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE provinces SET nom = $1, region_id = $2, synced = true WHERE code = $3',
                [p.nomProvince, regionId, code]
            );
        } else {
            await pool.query(
                'INSERT INTO provinces (nom, code, region_id, synced) VALUES ($1, $2, $3, true)',
                [p.nomProvince, code, regionId]
            );
        }
    }
}

// L'API expose /departements mais la table DB s'appelle communes
async function syncDepartements(token) {
    const res = await axios.get(`${BASE}/departements`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    for (const d of res.data) {
        const code = String(d.idDepartement);
        const provinceRow = await pool.query(
            'SELECT id, region_id FROM provinces WHERE code = $1',
            [String(d.idProvince ?? d.province?.idProvince)]
        );
        if (!provinceRow.rows[0]) continue;
        const { id: provinceId, region_id: regionId } = provinceRow.rows[0];

        const existing = await pool.query('SELECT id FROM communes WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE communes SET nom = $1, province_id = $2, region_id = $3, synced = true WHERE code = $4',
                [d.nomDepartement, provinceId, regionId, code]
            );
        } else {
            await pool.query(
                'INSERT INTO communes (nom, code, province_id, region_id, synced) VALUES ($1, $2, $3, $4, true)',
                [d.nomDepartement, code, provinceId, regionId]
            );
        }
    }
}

async function syncLocalites(token) {
    const res = await axios.get(`${BASE}/localites`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    for (const l of res.data) {
        const code = String(l.idLocalite);

        // Le code idLocalite encode la hiérarchie : RR PP DDD NNN
        const communeCode = code.substring(4, 7);
        const row = await pool.query(
            'SELECT id, province_id, region_id FROM communes WHERE code = $1',
            [communeCode]
        );

        if (!row.rows[0]) {
            console.warn(`⚠️  Localite ${code} ignorée : commune ${communeCode} introuvable`);
            continue;
        }

        const { id: communeId, province_id: provinceId, region_id: regionId } = row.rows[0];

        const existing = await pool.query('SELECT id FROM localites WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE localites SET nom = $1, commune_id = $2, province_id = $3, region_id = $4, synced = true WHERE code = $5',
                [l.nom, communeId, provinceId, regionId, code]
            );
        } else {
            await pool.query(
                'INSERT INTO localites (nom, code, commune_id, province_id, region_id, synced) VALUES ($1, $2, $3, $4, $5, true)',
                [l.nom, code, communeId, provinceId, regionId]
            );
        }
    }
}

async function syncStructures(token) {
    const res = await axios.get(`${BASE}/structures`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const structures = res.data;
    console.log(`📦 Structures reçues: ${structures.length}`);

    for (const s of structures) {
        await pool.query(`
            INSERT INTO structures (code, libelle_court, libelle_long, localite_id)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (code)
            DO UPDATE SET
                libelle_court = EXCLUDED.libelle_court,
                libelle_long  = EXCLUDED.libelle_long,
                localite_id   = EXCLUDED.localite_id
        `, [s.code, s.libelleCourt, s.libelleLong, s.localite?.idLocalite || null]);
    }

    for (const s of structures) {
        if (s.structrueRattachement) {
            await pool.query(
                'UPDATE structures SET structure_rattachement = $1 WHERE code = $2',
                [s.structrueRattachement.code, s.code]
            );
        }
    }

    console.log("✅ Structures sync OK");
}

module.exports = {
    syncRegions,
    syncProvinces,
    syncDepartements,
    syncLocalites,
    syncStructures
};
