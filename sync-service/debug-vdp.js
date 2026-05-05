require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_URL;

async function main() {
    // 1. Obtenir le token
    const qs = require('qs');
    const tokenRes = await axios.post(
        `${process.env.KC_URL}/realms/${process.env.KC_REALM}/protocol/openid-connect/token`,
        qs.stringify({
            grant_type:    'password',
            client_id:     process.env.KC_CLIENT_ID,
            client_secret: process.env.KC_CLIENT_SECRET,
            username:      process.env.KC_USER,
            password:      process.env.KC_PASS,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const token = tokenRes.data.access_token;

    // 2. Récupérer la page 0
    const res = await axios.get(`${BASE}/volontaires/page`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: 0, size: 1 }
    });

    const items = res.data.content ?? res.data;
    const first = items[0];

    console.log('\n=== STRUCTURE COMPLÈTE D\'UN VDP ===');
    console.log(JSON.stringify(first, null, 2));

    console.log('\n=== CLÉS DISPONIBLES ===');
    console.log(Object.keys(first));
}

main().catch(err => console.error('❌', err.message));
