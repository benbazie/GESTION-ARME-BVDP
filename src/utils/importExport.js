import { v4 as uuidv4 } from 'uuid';

// Exporter des données (tables = ['armes', 'vdp', ...])
export async function exportData(tables = []) {
  const result = {};
  for (const table of tables) {
    const rows = await window.api.call(`get${table.charAt(0).toUpperCase() + table.slice(1)}List`);
    // Ajoute un identifiant unique si absent
    result[table] = (rows || []).map(row => ({
      ...row,
      _export_uuid: row._export_uuid || uuidv4()
    }));
  }
  // Retourne un objet global à sauvegarder en JSON
  return result;
}

// Importer des données (data = objet JSON, tables = ['armes', ...])
export async function importData(data, tables = []) {
  const logs = [];
  for (const table of tables) {
    const items = data[table] || [];
    for (const item of items) {
      // Vérifie l’existence par UUID ou clé unique (ex: numero_serie pour armes)
      let exists = false;
      if (item._export_uuid) {
        const found = await window.api.call(`get${table.charAt(0).toUpperCase() + table.slice(1)}List`, { _export_uuid: item._export_uuid });
        exists = Array.isArray(found) && found.length > 0;
      }
      // Ajoute une vérification métier si besoin (ex: numero_serie pour armes)
      // if (!exists && table === 'armes' && item.numero_serie) { ... }

      if (!exists) {
        // Insère la donnée
        await window.api.call(`create${table.charAt(0).toUpperCase() + table.slice(1)}`, item);
        logs.push({ table, action: 'imported', id: item.id || null });
      } else {
        logs.push({ table, action: 'duplicate_skipped', id: item.id || null });
      }
    }
  }
  return logs;
}
