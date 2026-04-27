'use strict';

const db = require('../database/database');

(async () => {
  try {
    if (String(db?.client || '').toLowerCase() !== 'pg') {
      console.error('[pg-smoke-test] DB_CLIENT n\'est pas sur pg. Mets DB_CLIENT=pg dans .env.local');
      process.exitCode = 2;
      return;
    }

    const row = await db.get('SELECT version() AS version');
    console.log('[pg-smoke-test] Connexion OK.');
    console.log(row?.version || row);

    const ok = await db.get('SELECT 1 AS ok');
    console.log('[pg-smoke-test] SELECT 1 =>', ok);

    await db.close();
  } catch (err) {
    console.error('[pg-smoke-test] Échec:', err && err.message);
    process.exitCode = 1;
  }
})();
