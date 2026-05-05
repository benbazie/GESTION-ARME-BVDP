const axios = require('axios');
const qs = require('qs');
require('dotenv').config();

const TOKEN_URL =
    `${process.env.KC_URL}/realms/${process.env.KC_REALM}/protocol/openid-connect/token`;

let _cache = { token: null, expiresAt: 0 };

async function fetchNewToken() {
    const res = await axios.post(
        TOKEN_URL,
        qs.stringify({
            grant_type:    'password',
            client_id:     process.env.KC_CLIENT_ID,
            client_secret: process.env.KC_CLIENT_SECRET,
            username:      process.env.KC_USER,
            password:      process.env.KC_PASS,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const expiresIn = res.data.expires_in || 300; // secondes
    _cache = {
        token:     res.data.access_token,
        expiresAt: Date.now() + (expiresIn - 30) * 1000, // 30s de marge
    };

    return _cache.token;
}

// Retourne toujours un token valide — en renouvelle un si nécessaire
async function getAccessToken() {
    if (!_cache.token || Date.now() >= _cache.expiresAt) {
        await fetchNewToken();
    }
    return _cache.token;
}

module.exports = { getAccessToken };
