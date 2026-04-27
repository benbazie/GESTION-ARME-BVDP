const db = require('../database/database.js');

/**
 * Récupère toutes les configurations de matériel.
 */
const getConfigMateriel = () => {
  const sql = "SELECT * FROM config_materiel";
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur get config_materiel:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
};

/**
 * Liste toutes les configurations de matériel (API REST).
 */
const list = (req, res) => {
  getConfigMateriel()
    .then(rows => res.json(rows))
    .catch(err => {
      console.error("Erreur list config_materiel:", err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    });
};

/**
 * Récupère une configuration de matériel par son ID.
 */
const getConfigMaterielById = (id) => {
  const sql = "SELECT * FROM config_materiel WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur get config_materiel by id:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
};

/**
 * Ajoute une nouvelle configuration de matériel.
 */
const addConfigMateriel = ({ type, categorie, designation, observation }) => {
  if (!type || !categorie || !designation) {
    return Promise.reject(new Error("Les champs 'type', 'categorie' et 'designation' sont obligatoires."));
  }
  const sql = "INSERT INTO config_materiel (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur add config_materiel:", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration de matériel ajoutée", id: this.lastID });
    });
  });
};

/**
 * Met à jour une configuration de matériel existante.
 */
const updateConfigMateriel = ({ id, type, categorie, designation, observation }) => {
  const sql = "UPDATE config_materiel SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur update config_materiel:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de matériel non trouvée"));
      resolve({ message: "Configuration de matériel mise à jour" });
    });
  });
};

/**
 * Supprime une configuration de matériel.
 */
const deleteConfigMateriel = (id) => {
  const sql = "DELETE FROM config_materiel WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur delete config_materiel:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de matériel non trouvée"));
      resolve({ message: "Configuration de matériel supprimée" });
    });
  });
};

module.exports = {
  getConfigMateriel,
  getConfigMaterielById,
  addConfigMateriel,
  updateConfigMateriel,
  deleteConfigMateriel,
  list
};
