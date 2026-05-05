const cron = require('node-cron');

const { getAccessToken } = require('../services/keycloakService');
const carto = require('../services/cartographieService');
const { syncVolontaires } = require('../services/volontaireService');

async function runSync() {
    const token = await getAccessToken();

    console.log("🧭 Cartographie...");
    await carto.syncRegions(token);
    await carto.syncProvinces(token);
    await carto.syncDepartements(token);
    await carto.syncLocalites(token);

    console.log("👤 Volontaires...");
    await syncVolontaires(token);

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