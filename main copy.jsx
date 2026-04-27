'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database/database.js'); // Assurez-vous que ce module est correctement configuré
const tcpPortUsed = require('tcp-port-used');

// Démarrage du serveur Express (utilisé dans les deux modes)
require('./server');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Charge l'interface depuis le dossier "dist"
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  // Décommentez pour ouvrir les DevTools en développement
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    console.log("Fenêtre Electron chargée avec succès");
  });
}

if (process.env.MODE === 'web') {
  // Mode Web pur : ne crée pas de fenêtre Electron, seulement le serveur est lancé.
  // Le serveur Express est déjà lancé via require('./server');
} else {
  // Mode Electron : créer la fenêtre de l'application.
  app.whenReady().then(createWindow);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// -------------------------------------------------
// IPC Handlers pour la table "regions"
// -------------------------------------------------
ipcMain.handle("ipc-get-regions", async () => {
  const sql = `
    SELECT 
      regions.id, 
      regions.nom, 
      regions.code, 
      COUNT(provinces.id) AS nbProvinces
    FROM regions
    LEFT JOIN provinces ON provinces.region_id = regions.id
    GROUP BY regions.id
  `;
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur lors de la récupération des régions:", err.message);
        reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-region', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM regions WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get region):", err.message);
        return reject(err);
      }
      if (!row) {
        return reject(new Error("Région non trouvée"));
      }
      resolve(row);
    });
  });
});


ipcMain.handle('ipc-add-region', async (event, { nom, code }) => {
  if (!nom) throw new Error("Le champ 'nom' est obligatoire pour une région");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO regions (nom, code) VALUES (?, ?)";
    db.run(sql, [nom, code], function(err) {
      if (err) {
        console.error("Erreur IPC (create region):", err.message);
        return reject(err);
      }
      resolve({ message: "Région ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-region', async (event, { id, nom, code }) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE regions SET nom = ?, code = ? WHERE id = ?";
    db.run(sql, [nom, code, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update region):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Région non trouvée"));
      }
      resolve({ message: "Région mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-region', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM regions WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete region):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Région non trouvée"));
      }
      resolve({ message: "Région supprimée" });
    });
  });
});

// -------------------------------------------------
// IPC Handlers pour la table "provinces"
// -------------------------------------------------
ipcMain.handle('ipc-get-provinces', async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        provinces.*, 
        regions.nom AS region_nom, 
        regions.code AS region_code
      FROM provinces
      LEFT JOIN regions ON provinces.region_id = regions.id
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get provinces):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});
ipcMain.handle('ipc-get-province', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM provinces WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get province):", err.message);
        return reject(err);
      }
      if (!row) {
        return reject(new Error("Province non trouvée"));
      }
      resolve(row);
    });
  });
});

// Créer une province
ipcMain.handle('ipc-add-province', async (event, { nom, code, region_id }) => {
  if (!nom || !region_id) throw new Error("Les champs 'nom' et 'region_id' sont obligatoires pour une province");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO provinces (nom, code, region_id) VALUES (?, ?, ?)";
    db.run(sql, [nom, code, region_id], function(err) {
      if (err) {
        console.error("Erreur IPC (create province):", err.message);
        return reject(err);
      }
      resolve({ message: "Province ajoutée", id: this.lastID });
    });
  });
});

// Mettre à jour une province
ipcMain.handle('ipc-update-province', async (event, { id, nom, code, region_id }) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE provinces SET nom = ?, code = ?, region_id = ? WHERE id = ?";
    db.run(sql, [nom, code, region_id, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update province):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Province non trouvée"));
      }
      resolve({ message: "Province mise à jour" });
    });
  });
});

// Supprimer une province
ipcMain.handle('ipc-delete-province', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM provinces WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete province):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Province non trouvée"));
      }
      resolve({ message: "Province supprimée" });
    });
  });
});
ipcMain.handle('ipc-get-provinces-with-regions', async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        provinces.id,
        provinces.nom AS province_nom,
        provinces.code AS province_code,
        provinces.region_id,
        regions.nom AS region_nom,
        regions.code AS region_code
      FROM provinces
      LEFT JOIN regions ON provinces.region_id = regions.id
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get provinces):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// ----------------------
/// IPC pour la table "communes"
// ----------------------
ipcMain.handle('ipc-get-communes', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM communes";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get communes):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-commune', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM communes WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get commune):", err.message);
        return reject(err);
      }
      if (!row) {
        return reject(new Error("Commune non trouvée"));
      }
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-commune', async (event, { nom, code, province_id }) => {
  // Vérification que les champs obligatoires sont fournis
  if (!nom || !province_id) {
    throw new Error("Les champs 'nom' et 'province_id' sont obligatoires pour une commune");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO communes (nom, code, province_id) VALUES (?, ?, ?)";
    db.run(sql, [nom, code, province_id], function(err) {
      if (err) {
        console.error("Erreur IPC (create commune):", err.message);
        return reject(err);
      }
      resolve({ message: "Commune ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-commune', async (event, { id, nom, code, province_id }) => {
  // Vérification que l'ID et les champs obligatoires sont fournis
  if (!id) {
    throw new Error("L'ID de la commune est requis pour la mise à jour");
  }
  if (!nom || !province_id) {
    throw new Error("Les champs 'nom' et 'province_id' sont obligatoires pour une commune");
  }
  return new Promise((resolve, reject) => {
    const sql = "UPDATE communes SET nom = ?, code = ?, province_id = ? WHERE id = ?";
    db.run(sql, [nom, code, province_id, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update commune):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Commune non trouvée"));
      }
      resolve({ message: "Commune mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-commune', async (event, id) => {
  if (!id) {
    throw new Error("L'ID de la commune est requis pour la suppression");
  }
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM communes WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete commune):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Commune non trouvée"));
      }
      resolve({ message: "Commune supprimée" });
    });
  });
});
ipcMain.handle("ipc-get-communes-with-details", async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        c.id,
        c.nom,
        c.code,
        c.province_id,
        p.nom AS province_nom,
        p.code AS province_code,
        p.region_id,
        r.nom AS region_nom,
        r.code AS region_code
      FROM communes c 
      LEFT JOIN provinces p ON c.province_id = p.id
      LEFT JOIN regions r ON p.region_id = r.id
      ORDER BY c.id ASC;
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get communes with details):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle("ipc-get-localites", async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        l.id,
        l.nom,
        l.code,
        l.commune_id,
        c.nom AS commune_nom
      FROM localites l
      LEFT JOIN communes c ON l.commune_id = c.id
      ORDER BY l.id ASC;
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get localités):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// 2. Récupérer une localité par son ID
ipcMain.handle("ipc-get-localite", async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        l.id,
        l.nom,
        l.code,
        l.commune_id,
        c.nom AS commune_nom
      FROM localites l
      LEFT JOIN communes c ON l.commune_id = c.id
      WHERE l.id = ?;
    `;
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get localité):", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Localité non trouvée"));
      resolve(row);
    });
  });
});

// 3. Ajouter une nouvelle localité
ipcMain.handle("ipc-add-localite", async (event, { nom, code, commune_id }) => {
  return new Promise((resolve, reject) => {
    if (!nom || !commune_id) {
      return reject(new Error("Les champs 'nom' et 'commune_id' sont obligatoires"));
    }
    const sql = `INSERT INTO localites (nom, code, commune_id) VALUES (?, ?, ?);`;
    db.run(sql, [nom, code, commune_id], function (err) {
      if (err) {
        console.error("Erreur IPC (add localité):", err.message);
        return reject(err);
      }
      resolve({ id: this.lastID });
    });
  });
});

// 4. Mettre à jour une localité existante
ipcMain.handle("ipc-update-localite", async (event, { id, nom, code, commune_id }) => {
  return new Promise((resolve, reject) => {
    if (!id || !nom || !commune_id) {
      return reject(new Error("Les champs 'id', 'nom' et 'commune_id' sont obligatoires"));
    }
    const sql = `
      UPDATE localites
      SET nom = ?, code = ?, commune_id = ?
      WHERE id = ?;
    `;
    db.run(sql, [nom, code, commune_id, id], function (err) {
      if (err) {
        console.error("Erreur IPC (update localité):", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});

// 5. Supprimer une localité
ipcMain.handle("ipc-delete-localite", async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM localites WHERE id = ?;`;
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Erreur IPC (delete localité):", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});
ipcMain.handle("ipc-get-localites-with-details", async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        l.id,
        l.nom,
        l.code,
        l.commune_id,
        c.nom AS commune_nom,
        p.nom AS province_nom,
        p.code AS province_code,
        r.nom AS region_nom,
        r.code AS region_code
      FROM localites l
      LEFT JOIN communes c ON l.commune_id = c.id
      LEFT JOIN provinces p ON c.province_id = p.id
      LEFT JOIN regions r ON p.region_id = r.id
      ORDER BY l.id ASC;
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get localités with details):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});



/* ============================================================================
   HANDLERS POUR LA TABLE ENTITES
   ============================================================================ */

// Récupérer toutes les entités
ipcMain.handle('ipc-get-entites', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM entites";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get entites):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Récupérer une entité par son ID
ipcMain.handle('ipc-get-entite-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM entites WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get entite by id):", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Entité non trouvée"));
      resolve(row);
    });
  });
});

// Ajouter une nouvelle entité
ipcMain.handle('ipc-add-entite', async (event, entiteData) => {
  const { nom, code, type, description, region_id, province_id, commune_id, village_secteur_id } = entiteData;
  if (!nom || !code || !type)
    throw new Error("Les champs 'nom', 'code' et 'type' sont obligatoires pour une entité");
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO entites (nom, code, type, description, region_id, province_id, commune_id, village_secteur_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [nom, code, type, description, region_id, province_id, commune_id, village_secteur_id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (add entite):", err.message);
        return reject(err);
      }
      resolve({ message: "Entité ajoutée", id: this.lastID });
    });
  });
});

// Mettre à jour une entité existante
ipcMain.handle('ipc-update-entite', async (event, { id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE entites 
      SET nom = ?, code = ?, type = ?, description = ?, region_id = ?, province_id = ?, commune_id = ?, village_secteur_id = ?
      WHERE id = ?
    `;
    const values = [nom, code, type, description, region_id, province_id, commune_id, village_secteur_id, id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (update entite):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Entité non trouvée"));
      resolve({ message: "Entité mise à jour" });
    });
  });
});

// Supprimer une entité
ipcMain.handle('ipc-delete-entite', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM entites WHERE id = ?";
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Erreur IPC (delete entite):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Entité non trouvée"));
      resolve({ message: "Entité supprimée" });
    });
  });
});

/* ============================================================================
   HANDLERS POUR LA TABLE SOUS_ENTITES
   ============================================================================ */

// Récupérer toutes les sous-entités
ipcMain.handle('ipc-get-sousentites', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM sous_entites";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get sous_entites):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Récupérer une sous-entité par son ID
ipcMain.handle('ipc-get-sousentite-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM sous_entites WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get sous_entite by id):", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Sous-entité non trouvée"));
      resolve(row);
    });
  });
});

// Ajouter une nouvelle sous-entité
ipcMain.handle('ipc-add-sousentite', async (event, sousEntiteData) => {
  const { entite_id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id } = sousEntiteData;
  if (!entite_id || !nom || !code || !type)
    throw new Error("Les champs 'entite_id', 'nom', 'code' et 'type' sont obligatoires pour une sous-entité");
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO sous_entites (entite_id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [entite_id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (add sous_entite):", err.message);
        return reject(err);
      }
      resolve({ message: "Sous-entité ajoutée", id: this.lastID });
    });
  });
});

// Mettre à jour une sous-entité existante
ipcMain.handle('ipc-update-sousentite', async (event, { id, entite_id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE sous_entites 
      SET entite_id = ?, nom = ?, code = ?, type = ?, description = ?, region_id = ?, province_id = ?, commune_id = ?, village_secteur_id = ?
      WHERE id = ?
    `;
    const values = [entite_id, nom, code, type, description, region_id, province_id, commune_id, village_secteur_id, id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (update sous_entite):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Sous-entité non trouvée"));
      resolve({ message: "Sous-entité mise à jour" });
    });
  });
});

// Supprimer une sous-entité
ipcMain.handle('ipc-delete-sousentite', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM sous_entites WHERE id = ?";
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Erreur IPC (delete sous_entite):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Sous-entité non trouvée"));
      resolve({ message: "Sous-entité supprimée" });
    });
  });
});

/* ============================================================================
   HANDLERS POUR LA TABLE COORDINATIONS
   ============================================================================ */

// Récupérer toutes les coordinations
ipcMain.handle('ipc-get-coordinations', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM coordinations";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get coordinations):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Récupérer une coordination par son ID
ipcMain.handle('ipc-get-coordination-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM coordinations WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get coordination by id):", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Coordination non trouvée"));
      resolve(row);
    });
  });
});

// Ajouter une nouvelle coordination
ipcMain.handle('ipc-add-coordination', async (event, coordinationData) => {
  const { entite_id, nom, code, type, description, region_id, province_id, commune_id } = coordinationData;
  if (!entite_id || !nom || !code || !type)
    throw new Error("Les champs 'entite_id', 'nom', 'code' et 'type' sont obligatoires pour une coordination");
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO coordinations (entite_id, nom, code, type, description, region_id, province_id, commune_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [entite_id, nom, code, type, description, region_id, province_id, commune_id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (add coordination):", err.message);
        return reject(err);
      }
      resolve({ message: "Coordination ajoutée", id: this.lastID });
    });
  });
});

// Mettre à jour une coordination existante
ipcMain.handle('ipc-update-coordination', async (event, { id, entite_id, nom, code, type, description, region_id, province_id, commune_id }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE coordinations 
      SET entite_id = ?, nom = ?, code = ?, type = ?, description = ?, region_id = ?, province_id = ?, commune_id = ?
      WHERE id = ?
    `;
    const values = [entite_id, nom, code, type, description, region_id, province_id, commune_id, id];
    db.run(sql, values, function (err) {
      if (err) {
        console.error("Erreur IPC (update coordination):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Coordination non trouvée"));
      resolve({ message: "Coordination mise à jour" });
    });
  });
});

// Supprimer une coordination
ipcMain.handle('ipc-delete-coordination', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM coordinations WHERE id = ?";
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Erreur IPC (delete coordination):", err.message);
        return reject(err);
      }
      if (this.changes === 0)
        return reject(new Error("Coordination non trouvée"));
      resolve({ message: "Coordination supprimée" });
    });
  });
});

// -----------------------------
// IPC Handlers pour la table "vdp"
// -----------------------------

// Récupérer tous les VDP
ipcMain.handle('ipc-get-vdps', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM vdp";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get VDPs):", err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

// Récupérer un VDP par ID
ipcMain.handle('ipc-get-vdp-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM vdp WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get VDP by id):", err.message);
        reject(err);
      } else if (!row) {
        reject(new Error("VDP non trouvé"));
      } else {
        resolve(row);
      }
    });
  });
});
ipcMain.handle('ipc-get-vdp', async (event, id) => {
  return new Promise((resolve, reject) => {
    // Exemple de requête SQL pour récupérer un VDP par id
    const sql = "SELECT * FROM vdp WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get vdp):", err.message);
        return reject(err);
      }
      if (!row) {
        return reject(new Error("VDP non trouvé"));
      }
      resolve(row);
    });
  });
});
// Créer un VDP
ipcMain.handle('ipc-add-vdp', async (event, vdpData) => {
  const {
    nom, prenom, date_naissance, lieu_naissance, numero_cnib, date_cnib, date_recrutement,
    statut_vdp, statut_matrimonial, nb_enfants, entite_id, type_vdp, contacts, photo,
    observation, code_qr, contact_urgence1, contact_urgence2, contact_urgence3,
    nom_personne_prevenir, lien_personne_prevenir
  } = vdpData;
  
  if (!nom || !prenom || !entite_id || !contact_urgence1) {
    throw new Error("Les champs 'nom', 'prenom', 'entite_id' et 'contact_urgence1' sont obligatoires pour un VDP");
  }
  
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO vdp 
      (nom, prenom, date_naissance, lieu_naissance, numero_cnib, date_cnib, date_recrutement,
       statut_vdp, statut_matrimonial, nb_enfants, entite_id, type_vdp, contacts, photo, observation,
       code_qr, contact_urgence1, contact_urgence2, contact_urgence3, nom_personne_prevenir, lien_personne_prevenir)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      nom, prenom, date_naissance, lieu_naissance, numero_cnib, date_cnib, date_recrutement,
      statut_vdp, statut_matrimonial, nb_enfants, entite_id, type_vdp, contacts, photo, observation,
      code_qr, contact_urgence1, contact_urgence2, contact_urgence3, nom_personne_prevenir, lien_personne_prevenir
    ];
    db.run(sql, values, function(err) {
      if (err) {
        console.error("Erreur IPC (create VDP):", err.message);
        reject(err);
      } else {
        resolve({ message: "VDP ajouté avec succès", id: this.lastID });
      }
    });
  });
});

// Mettre à jour un VDP existant
ipcMain.handle('ipc-update-vdp', async (event, { id, ...vdpData }) => {
  const {
    nom, prenom, date_naissance, lieu_naissance, numero_cnib, date_cnib, date_recrutement,
    statut_vdp, statut_matrimonial, nb_enfants, entite_id, type_vdp, contacts, photo,
    observation, code_qr, contact_urgence1, contact_urgence2, contact_urgence3,
    nom_personne_prevenir, lien_personne_prevenir
  } = vdpData;
  
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE vdp SET
        nom = ?, prenom = ?, date_naissance = ?, lieu_naissance = ?, numero_cnib = ?,
        date_cnib = ?, date_recrutement = ?, statut_vdp = ?, statut_matrimonial = ?, nb_enfants = ?,
        entite_id = ?, type_vdp = ?, contacts = ?, photo = ?, observation = ?, code_qr = ?,
        contact_urgence1 = ?, contact_urgence2 = ?, contact_urgence3 = ?,
        nom_personne_prevenir = ?, lien_personne_prevenir = ?
      WHERE id = ?
    `;
    const values = [
      nom, prenom, date_naissance, lieu_naissance, numero_cnib,
      date_cnib, date_recrutement, statut_vdp, statut_matrimonial, nb_enfants,
      entite_id, type_vdp, contacts, photo, observation, code_qr,
      contact_urgence1, contact_urgence2, contact_urgence3,
      nom_personne_prevenir, lien_personne_prevenir, id
    ];
    db.run(sql, values, function(err) {
      if (err) {
        console.error("Erreur IPC (update VDP):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("VDP non trouvé"));
      }
      resolve({ message: "VDP mis à jour avec succès" });
    });
  });
});

// Supprimer un VDP
ipcMain.handle('ipc-delete-vdp', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM vdp WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete VDP):", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("VDP non trouvé"));
      }
      resolve({ message: "VDP supprimé avec succès" });
    });
  });
});

// --- config_arme ---
ipcMain.handle('ipc-get-config-arme', async () => {
  console.log("Handler 'ipc-get-config-arme' appelé");
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_arme";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur lors de la requête SQL (get config_arme):", err.message);
        return reject(err);
      }
      console.log("Données récupérées (rows) :", rows);
      resolve(rows);  // rows devrait être un tableau, même vide, jamais undefined
    });
  });
});



ipcMain.handle('ipc-add-config-arme', async (event, data) => {
  const { type, categorie, designation, observation } = data;
  if (!type || !categorie || !designation) {
    throw new Error("Les champs 'type', 'categorie' et 'designation' sont obligatoires.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO config_arme (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur IPC (create config_arme):", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration d'arme ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-config-arme', async (event, data) => {
  const { id, type, categorie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE config_arme SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update config_arme):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'arme non trouvée"));
      resolve({ message: "Configuration d'arme mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-config-arme', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM config_arme WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete config_arme):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'arme non trouvée"));
      resolve({ message: "Configuration d'arme supprimée" });
    });
  });
});
ipcMain.handle('ipc-get-config-arme-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_arme WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur IPC (get config_arme by id):", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
});

// --- config_optique ---
ipcMain.handle('ipc-get-config-optique', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_optique";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get config_optique):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-add-config-optique', async (event, data) => {
  const { type, categorie, designation, observation } = data;
  if (!type || !designation) {
    throw new Error("Les champs 'type' et 'designation' sont obligatoires.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO config_optique (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur IPC (create config_optique):", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration d'optique ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-config-optique', async (event, data) => {
  const { id, type, categorie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE config_optique SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update config_optique):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'optique non trouvée"));
      resolve({ message: "Configuration d'optique mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-config-optique', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM config_optique WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete config_optique):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'optique non trouvée"));
      resolve({ message: "Configuration d'optique supprimée" });
    });
  });
});

// --- config_munition ---
ipcMain.handle('ipc-get-config-munitions', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_munition";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur SQL (get config munitions):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-config-munition-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_munition WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur SQL (get config munition by id):", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-config-munition', async (event, data) => {
  return new Promise((resolve, reject) => {
    const { type, calibre, designation, observation } = data;
    const sql = "INSERT INTO config_munition (type, calibre, designation, observation) VALUES (?, ?, ?, ?)";
    db.run(sql, [type, calibre, designation, observation], function (err) {
      if (err) {
        console.error("Erreur SQL (add config munition):", err.message);
        return reject(err);
      }
      resolve({ id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-config-munition', async (event, data) => {
  return new Promise((resolve, reject) => {
    const { id, type, calibre, designation, observation } = data;
    const sql = "UPDATE config_munition SET type = ?, calibre = ?, designation = ?, observation = ? WHERE id = ?";
    db.run(sql, [type, calibre, designation, observation, id], function (err) {
      if (err) {
        console.error("Erreur SQL (update config munition):", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});

ipcMain.handle('ipc-delete-config-munition', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM config_munition WHERE id = ?";
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Erreur SQL (delete config munition):", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});
ipcMain.handle('ipc-get-config-munition', async () => {
  console.log("Handler 'ipc-get-config-munition' appelé");
  return new Promise((resolve, reject) => {
    // Vérifier si la table existe
    const checkTable = "SELECT name FROM sqlite_master WHERE type='table' AND name='config_munition'";
    db.get(checkTable, [], (err, row) => {
      if (err) {
        console.error("Erreur lors de la vérification de la table:", err);
        return reject(err);
      }
      
      if (!row) {
        console.error("La table config_munition n'existe pas");
        return reject(new Error("Table config_munition non trouvée"));
      }
      
      // Si la table existe, récupérer les données
      const sql = "SELECT * FROM config_munition";
      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Erreur SQL (get config munition):", err.message);
          return reject(err);
        }
        console.log("Données récupérées:", rows);
        resolve(rows);
      });
    });
  });
});

// --- config_materiel ---
ipcMain.handle('ipc-get-config-materiel', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM config_materiel";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur IPC (get config_materiel):", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-add-config-materiel', async (event, data) => {
  const { type, categorie, designation, observation } = data;
  if (!type || !designation) {
    throw new Error("Les champs 'type' et 'designation' sont obligatoires.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO config_materiel (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur IPC (create config_materiel):", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration de matériel ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-config-materiel', async (event, data) => {
  const { id, type, categorie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE config_materiel SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur IPC (update config_materiel):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de matériel non trouvée"));
      resolve({ message: "Configuration de matériel mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-config-materiel', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM config_materiel WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur IPC (delete config_materiel):", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de matériel non trouvée"));
      resolve({ message: "Configuration de matériel supprimée" });
    });
  });
});

console.log("Partie 4/5 : IPC Handlers pour configurations et ressources transactionnelles enregistrés.");

// =================================================
// IPC HANDLERS - TABLE "arme"
// =================================================
ipcMain.handle('ipc-get-armes', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM arme";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get armes:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-arme', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM arme WHERE id = ?", [id], (err, row) => {
      if (err) {
        console.error("Erreur lors de la requête sur arme:", err);
        return reject(err);
      } else {
        resolve(row);
      }
    });
  });
});

ipcMain.handle('ipc-add-arme', async (event, data) => {
  const { config_arme_id, numero_serie, statut, etat, lot, date_entree, date_sortie } = data;
  if (!config_arme_id || !numero_serie)
    throw new Error("Les champs 'config_arme_id' et 'numero_serie' sont obligatoires pour une arme.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO arme (config_arme_id, numero_serie, statut, etat, lot, date_entree, date_sortie) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.run(sql, [config_arme_id, numero_serie, statut, etat, lot, date_entree, date_sortie], function(err) {
      if (err) {
        console.error("IPC erreur create arme:", err.message);
        return reject(err);
      }
      resolve({ message: "Arme ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-arme', async (event, data) => {
  const { id, config_arme_id, numero_serie, statut, etat, lot, date_entree, date_sortie } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE arme SET config_arme_id = ?, numero_serie = ?, statut = ?, etat = ?, lot = ?, date_entree = ?, date_sortie = ? WHERE id = ?";
    db.run(sql, [config_arme_id, numero_serie, statut, etat, lot, date_entree, date_sortie, id], function(err) {
      if (err) {
        console.error("IPC erreur update arme:", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Arme non trouvée"));
      }
      resolve({ message: "Arme mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-arme', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM arme WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete arme:", err.message);
        return reject(err);
      }
      if (this.changes === 0) {
        return reject(new Error("Arme non trouvée"));
      }
      resolve({ message: "Arme supprimée" });
    });
  });
});

// =================================================
// IPC HANDLERS - TABLE "optique"
// =================================================
ipcMain.handle('ipc-get-optique', async (event, id) => {
  console.log("Handler ipc-get-optique appelé pour l'ID :", id);
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT o.*, c.type AS config_type, c.designation AS config_designation, c.categorie AS config_categorie
      FROM optique o
      LEFT JOIN config_optique c ON o.config_optique_id = c.id
      WHERE o.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur lors de la récupération de l'optique :", err.message);
        return reject(err);
      }
      console.log("Optique récupérée :", row);
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-optique', async (event, data) => {
  const { config_optique_id, numero_serie, etat, date_entree, date_sortie } = data;
  if (!config_optique_id || !numero_serie)
    throw new Error("Les champs 'config_optique_id' et 'numero_serie' sont obligatoires pour une optique.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO optique (config_optique_id, numero_serie, etat, date_entree, date_sortie) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [config_optique_id, numero_serie, etat, date_entree, date_sortie], function(err) {
      if (err) {
        console.error("IPC erreur create optique:", err.message);
        return reject(err);
      }
      resolve({ message: "Optique ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-optique', async (event, data) => {
  const { id, config_optique_id, numero_serie, etat, date_entree, date_sortie } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE optique SET config_optique_id = ?, numero_serie = ?, etat = ?, date_entree = ?, date_sortie = ? WHERE id = ?";
    db.run(sql, [config_optique_id, numero_serie, etat, date_entree, date_sortie, id], function(err) {
      if (err) {
        console.error("IPC erreur update optique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Optique non trouvée"));
      resolve({ message: "Optique mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-optique', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM optique WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete optique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Optique non trouvée"));
      resolve({ message: "Optique supprimée" });
    });
  });
});

ipcMain.handle('ipc-get-optiques', async () => {
  console.log("Handler ipc-get-optiques appelé");
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT o.id, o.numero_serie, o.etat, o.date_entree, o.date_sortie, 
             c.type AS config_type, c.designation AS config_designation
      FROM optique o
      LEFT JOIN config_optique c ON o.config_optique_id = c.id
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur lors de la récupération des optiques :", err.message);
        return reject(err);
      }
      console.log("Optiques récupérées :", rows);
      resolve(rows);
    });
  });
});

/// IPC HANDLERS - TABLE "munition"
// --------------------------------------------------
ipcMain.handle('ipc-get-munition', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM munition";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get munition:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-munition-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM munition WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get munition by id:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-munition', async (event, data) => {
  const { config_munition_id, quantite, date_entree, date_sortie, designation, observation } = data;
  // Désignation est désormais obligatoire
  if (!config_munition_id || quantite == null || !designation)
    throw new Error("Les champs 'config_munition_id', 'quantite' et 'designation' sont obligatoires pour une munition.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO munition (config_munition_id, quantite, date_entree, date_sortie, designation, observation) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [config_munition_id, quantite, date_entree, date_sortie, designation, observation], function(err) {
      if (err) {
        console.error("IPC erreur create munition:", err.message);
        return reject(err);
      }
      resolve({ message: "Munition ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-munition', async (event, data) => {
  const { id, config_munition_id, quantite, date_entree, date_sortie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE munition SET config_munition_id = ?, quantite = ?, date_entree = ?, date_sortie = ?, designation = ?, observation = ? WHERE id = ?";
    db.run(sql, [config_munition_id, quantite, date_entree, date_sortie, designation, observation, id], function(err) {
      if (err) {
        console.error("IPC erreur update munition:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Munition non trouvée"));
      resolve({ message: "Munition mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-munition', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM munition WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete munition:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Munition non trouvée"));
      resolve({ message: "Munition supprimée" });
    });
  });
});

ipcMain.handle('ipc-get-all-munitions', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM munition";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur lors de la récupération des munitions:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});


// =================================================
// IPC HANDLERS - TABLE "materiel_specifique"
// =================================================
ipcMain.handle('ipc-get-materiel_specifique', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM materiel_specifique";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get materiel_specifique:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-add-materiel_specifique', async (event, data) => {
  const { config_materiel_id, numero_serie, etat, date_entree, date_sortie } = data;
  if (!config_materiel_id || !numero_serie)
    throw new Error("Les champs 'config_materiel_id' et 'numero_serie' sont obligatoires pour le matériel spécifique.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO materiel_specifique (config_materiel_id, numero_serie, etat, date_entree, date_sortie) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [config_materiel_id, numero_serie, etat, date_entree, date_sortie], function(err) {
      if (err) {
        console.error("IPC erreur create materiel_specifique:", err.message);
        return reject(err);
      }
      resolve({ message: "Matériel spécifique ajouté", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-materiel_specifique', async (event, data) => {
  const { id, config_materiel_id, numero_serie, etat, date_entree, date_sortie } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE materiel_specifique SET config_materiel_id = ?, numero_serie = ?, etat = ?, date_entree = ?, date_sortie = ? WHERE id = ?";
    db.run(sql, [config_materiel_id, numero_serie, etat, date_entree, date_sortie, id], function(err) {
      if (err) {
        console.error("IPC erreur update materiel_specifique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Matériel spécifique non trouvé"));
      resolve({ message: "Matériel spécifique mis à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-materiel_specifique', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM materiel_specifique WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete materiel_specifique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Matériel spécifique non trouvé"));
      resolve({ message: "Matériel spécifique supprimé" });
    });
  });
});

// =================================================
// IPC HANDLERS - TABLE "lots"
// =================================================
ipcMain.handle('ipc-add-lot', async (event, lotData) => {
  return new Promise((resolve, reject) => {
    const { designation, date_debut, date_fin, description } = lotData;
    const sql = `
      INSERT INTO lot (designation, date_debut, date_fin, description)
      VALUES (?, ?, ?, ?)
    `;
    db.run(sql, [designation, date_debut, date_fin, description], function(err) {
      if (err) {
        console.error("Erreur lors de l'insertion d'un lot:", err.message);
        return reject(err);
      }
      resolve({ id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-get-lot', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id, designation, date_debut, date_fin, description FROM lot WHERE id = ?`; // Mise à jour pour utiliser "designation"
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur lors de la récupération du lot:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
});

// Handler pour mettre à jour un lot
ipcMain.handle('ipc-update-lot', async (event, lotData) => {
  return new Promise((resolve, reject) => {
    const { id, designation, date_debut, date_fin, description } = lotData;
    const sql = `
      UPDATE lot
      SET designation = ?, date_debut = ?, date_fin = ?, description = ?
      WHERE id = ?
    `;
    db.run(sql, [designation, date_debut, date_fin, description, id], function(err) {
      if (err) {
        console.error("Erreur lors de la mise à jour du lot:", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});

// Handler pour récupérer un lot par ID
ipcMain.handle('ipc-get-lot-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id, designation, date_debut, date_fin, description FROM lot WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur lors de la récupération du lot:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
});

// Handler pour récupérer tous les lots
ipcMain.handle('ipc-get-all-lots', async (event) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id, designation, date_debut, date_fin, description FROM lot ORDER BY id DESC`; // Mise à jour pour utiliser "designation"
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur lors de la récupération de tous les lots:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

// Handler pour supprimer un lot
ipcMain.handle('ipc-delete-lot', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM lot WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur lors de la suppression du lot:", err.message);
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
});
// ------------------------------
// IPC HANDLERS - TABLE "audit_logs"
// ------------------------------
ipcMain.handle('ipc-get-audit_logs', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM audit_logs";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get audit_logs:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-add-audit_log', async (event, data) => {
  const { user_id, table_name, record_id, action, details } = data;
  if (!table_name || !action) {
    throw new Error("Les champs 'table_name' et 'action' sont obligatoires pour un audit log.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO audit_logs (user_id, table_name, record_id, action, details) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [user_id, table_name, record_id, action, details], function(err) {
      if (err) {
        console.error("IPC erreur create audit_log:", err.message);
        return reject(err);
      }
      resolve({ message: "Audit log ajouté", id: this.lastID });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "sync_logs"
// ------------------------------
ipcMain.handle('ipc-get-sync_logs', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM sync_logs";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get sync_logs:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-add-sync_log', async (event, data) => {
  const { source, table_name, action, nb_records, status, error_message } = data;
  if (!source || !table_name || !action || !status) {
    throw new Error("Les champs 'source', 'table_name', 'action' et 'status' sont obligatoires pour un sync log.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO sync_logs (source, table_name, action, nb_records, status, error_message) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [source, table_name, action, nb_records, status, error_message], function(err) {
      if (err) {
        console.error("IPC erreur create sync_log:", err.message);
        return reject(err);
      }
      resolve({ message: "Sync log ajouté", id: this.lastID });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "sessions"
// ------------------------------
ipcMain.handle('ipc-get-sessions', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM sessions";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get sessions:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-session-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM sessions WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get session by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Session non trouvée"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-session', async (event, data) => {
  const { user_id, token } = data;
  if (!user_id || !token) {
    throw new Error("Les champs 'user_id' et 'token' sont obligatoires pour une session.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO sessions (user_id, token) VALUES (?, ?)";
    db.run(sql, [user_id, token], function(err) {
      if (err) {
        console.error("IPC erreur create session:", err.message);
        return reject(err);
      }
      resolve({ message: "Session créée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-session', async (event, data) => {
  const { id, date_fin } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE sessions SET date_fin = ? WHERE id = ?";
    db.run(sql, [date_fin, id], function(err) {
      if (err) {
        console.error("IPC erreur update session:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Session non trouvée"));
      resolve({ message: "Session mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-session', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM sessions WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete session:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Session non trouvée"));
      resolve({ message: "Session supprimée" });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "notifications"
// ------------------------------
ipcMain.handle('ipc-get-notifications', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM notifications";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get notifications:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-notification-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM notifications WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get notification by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Notification non trouvée"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-notification', async (event, data) => {
  const { user_id, message: msg, vue } = data;
  if (!msg) {
    throw new Error("Le champ 'message' est obligatoire pour une notification.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO notifications (user_id, message, vue) VALUES (?, ?, ?)";
    db.run(sql, [user_id, msg, vue || 0], function(err) {
      if (err) {
        console.error("IPC erreur create notification:", err.message);
        return reject(err);
      }
      resolve({ message: "Notification ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-notification', async (event, data) => {
  const { id, message: msg, vue } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE notifications SET message = ?, vue = ? WHERE id = ?";
    db.run(sql, [msg, vue, id], function(err) {
      if (err) {
        console.error("IPC erreur update notification:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Notification non trouvée"));
      resolve({ message: "Notification mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-notification', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM notifications WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete notification:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Notification non trouvée"));
      resolve({ message: "Notification supprimée" });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "roles"
// ------------------------------
ipcMain.handle('ipc-get-roles', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM roles";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get roles:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-role-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM roles WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get role by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Rôle non trouvé"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-role', async (event, data) => {
  const { nom, permissions } = data;
  if (!nom) throw new Error("Le champ 'nom' est obligatoire pour un rôle.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO roles (nom, permissions) VALUES (?, ?)";
    db.run(sql, [nom, permissions], function(err) {
      if (err) {
        console.error("IPC erreur create role:", err.message);
        return reject(err);
      }
      resolve({ message: "Rôle ajouté", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-role', async (event, data) => {
  const { id, nom, permissions } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE roles SET nom = ?, permissions = ? WHERE id = ?";
    db.run(sql, [nom, permissions, id], function(err) {
      if (err) {
        console.error("IPC erreur update role:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Rôle non trouvé"));
      resolve({ message: "Rôle mis à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-role', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM roles WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete role:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Rôle non trouvé"));
      resolve({ message: "Rôle supprimé" });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "utilisateurs"
// ------------------------------
ipcMain.handle('ipc-get-utilisateurs', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM utilisateurs";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get utilisateurs:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-utilisateur-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM utilisateurs WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get utilisateur by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Utilisateur non trouvé"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-utilisateur', async (event, data) => {
  const { nom_utilisateur, mot_de_passe, role_id } = data;
  if (!nom_utilisateur || !mot_de_passe || !role_id) {
    throw new Error("Les champs 'nom_utilisateur', 'mot_de_passe' et 'role_id' sont obligatoires pour un utilisateur.");
  }
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe, role_id) VALUES (?, ?, ?)";
    db.run(sql, [nom_utilisateur, mot_de_passe, role_id], function(err) {
      if (err) {
        console.error("IPC erreur create utilisateur:", err.message);
        return reject(err);
      }
      resolve({ message: "Utilisateur ajouté", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-utilisateur', async (event, data) => {
  const { id, nom_utilisateur, mot_de_passe, role_id } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE utilisateurs SET nom_utilisateur = ?, mot_de_passe = ?, role_id = ? WHERE id = ?";
    db.run(sql, [nom_utilisateur, mot_de_passe, role_id, id], function(err) {
      if (err) {
        console.error("IPC erreur update utilisateur:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Utilisateur non trouvé"));
      resolve({ message: "Utilisateur mis à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-utilisateur', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM utilisateurs WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete utilisateur:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Utilisateur non trouvé"));
      resolve({ message: "Utilisateur supprimé" });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "app_config"
// ------------------------------
ipcMain.handle('ipc-get-app_config', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM app_config";
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("IPC erreur get app_config:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-app_config-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM app_config WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("IPC erreur get app_config by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Configuration non trouvée"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-app_config', async (event, data) => {
  const { nom_param, valeur, description } = data;
  if (!nom_param) throw new Error("Le champ 'nom_param' est obligatoire pour une configuration");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO app_config (nom_param, valeur, description) VALUES (?, ?, ?)";
    db.run(sql, [nom_param, valeur, description], function(err) {
      if (err) {
        console.error("IPC erreur create app_config:", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration ajoutée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-app_config', async (event, data) => {
  const { id, nom_param, valeur, description } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE app_config SET nom_param = ?, valeur = ?, description = ? WHERE id = ?";
    db.run(sql, [nom_param, valeur, description, id], function(err) {
      if (err) {
        console.error("IPC erreur update app_config:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration non trouvée"));
      resolve({ message: "Configuration mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-app_config', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM app_config WHERE id = ?";
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("IPC erreur delete app_config:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration non trouvée"));
      resolve({ message: "Configuration supprimée" });
    });
  });
});

// ------------------------------
// IPC HANDLERS - TABLE "consommation_munitions"
// ------------------------------
ipcMain.handle('ipc-get-consommation-munitions', async () => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM consommation_munitions";
    db.all(sql, [], (err, rows) => {
      if(err) {
        console.error("IPC erreur get consommation_munitions:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('ipc-get-consommation-munition-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM consommation_munitions WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if(err) {
        console.error("IPC erreur get consommation_munition by id:", err.message);
        return reject(err);
      }
      if (!row) return reject(new Error("Consommation de munitions non trouvée"));
      resolve(row);
    });
  });
});

ipcMain.handle('ipc-add-consommation-munition', async (event, data) => {
  const { munition_id, quantite_consommee, remarque } = data;
  if (!munition_id || quantite_consommee == null)
    throw new Error("Les champs 'munition_id' et 'quantite_consommee' sont obligatoires pour une consommation de munitions.");
  return new Promise((resolve, reject) => {
    const sql = "INSERT INTO consommation_munitions (munition_id, quantite_consommee, remarque) VALUES (?, ?, ?)";
    db.run(sql, [munition_id, quantite_consommee, remarque], function(err) {
      if(err) {
        console.error("IPC erreur create consommation_munitions:", err.message);
        return reject(err);
      }
      resolve({ message: "Consommation enregistrée", id: this.lastID });
    });
  });
});

ipcMain.handle('ipc-update-consommation-munition', async (event, data) => {
  const { id, munition_id, quantite_consommee, remarque } = data;
  return new Promise((resolve, reject) => {
    const sql = "UPDATE consommation_munitions SET munition_id = ?, quantite_consommee = ?, remarque = ? WHERE id = ?";
    db.run(sql, [munition_id, quantite_consommee, remarque, id], function(err) {
      if(err) {
        console.error("IPC erreur update consommation_munitions:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Consommation non trouvée"));
      resolve({ message: "Consommation mise à jour" });
    });
  });
});

ipcMain.handle('ipc-delete-consommation-munition', async (event, id) => {
  return new Promise((resolve, reject) => {
    const sql = "DELETE FROM consommation_munitions WHERE id = ?";
    db.run(sql, [id], function(err) {
      if(err) {
        console.error("IPC erreur delete consommation_munitions:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Consommation non trouvée"));
      resolve({ message: "Consommation supprimée" });
    });
  });
});

console.log("Partie 5/5 : IPC Handlers pour les Tables du Système enregistrés.");

ipcMain.handle('ipc-check-duplicate-arme', async (event, numeroSerie) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM arme WHERE numero_serie = ?";
    db.get(sql, [numeroSerie], (err, row) => {
      if (err) {
        console.error("Erreur lors de la vérification du doublon d'arme :", err.message);
        return reject(err);
      }
      // Si row existe, c'est un doublon, sinon pas.
      resolve(!!row);
    });
  });
});

ipcMain.handle("get-config-arme-by-id", async (event, id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM config_arme WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
});

ipcMain.handle("add-config-arme", async (event, data) => {
  const { type, categorie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO config_arme (type, categorie, designation, observation) VALUES (?, ?, ?, ?)",
      [type, categorie, designation, observation],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

ipcMain.handle("update-config-arme", async (event, data) => {
  const { id, type, categorie, designation, observation } = data;
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE config_arme SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?",
      [type, categorie, designation, observation, id],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
});

ipcMain.handle("delete-config-arme", async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM config_arme WHERE id = ?", [id], function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
});
ipcMain.handle("get-config-arme", async (event) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM config_arme", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

// Fermer l'application lorsque toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
