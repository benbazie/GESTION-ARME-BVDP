const cron = require('node-cron');

const { getAccessToken } = require('../services/keycloakService');
const carto = require('../services/cartographieService');
const { syncVolontaires } = require('../services/volontaireService');
const { syncPhotos } = require('../services/photoService');

async function safeStep(label, fn, retries = 2) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            await fn();
            return;
        } catch (err) {
            const isNetwork = err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' ||
                              /socket hang up|ETIMEDOUT|ENOTFOUND/i.test(err.message);
            if (isNetwork && attempt <= retries) {
                const delay = attempt * 5000;
                console.warn(`⚠️  ${label} (tentative ${attempt}) : ${err.message} — retry dans ${delay / 1000}s`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error(`❌ ${label} échoué : ${err.message}`);
                return;
            }
        }
    }
}

async function runSync() {
    const token = await getAccessToken();

    console.log("🧭 Cartographie...");
    await safeStep('syncRegions',      () => carto.syncRegions(token));
    await safeStep('syncProvinces',    () => carto.syncProvinces(token));
    await safeStep('syncDepartements', () => carto.syncDepartements(token));
    await safeStep('syncLocalites',    () => carto.syncLocalites(token));

    console.log("👤 Volontaires...");
    await safeStep('syncVolontaires', () => syncVolontaires(token));

    console.log("📸 Photos VDP...");
    await safeStep('syncPhotos', () => syncPhotos());

    console.log("🎉 SYNC COMPLETE");
}

function startCron() {

    console.log("🚀 Lancement initial de la synchronisation...");

    // 🔥 1. Sync immédiate au démarrage
    runSync().catch(err => {
        console.error("❌ Erreur sync initiale :", err.message);
    });

    // ⏰ 2. Sync automatique toutes les 24h
    cron.schedule('0 0 * * *', async () => {
        console.log("⏰ Lancement CRON (24h)...");
        await runSync();
    });
}
module.exports = { startCron };