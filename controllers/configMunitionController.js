const db = require('../database/database.js');

/**
 * Récupère toutes les configurations de munition.
 */
const getConfigMunition = () => {
  const sql = "SELECT * FROM config_munition";
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur get config_munition:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
};

/**
 * Liste toutes les configurations de munition (API REST).
 */
const list = (req, res) => {
  getConfigMunition()
    .then(rows => res.json(rows))
    .catch(err => {
      console.error("Erreur list config_munition:", err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    });
};

/**
 * Récupère une configuration de munition par son ID.
 */
const getConfigMunitionById = (id) => {
  const sql = "SELECT * FROM config_munition WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur get config_munition by id:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
};

/**
 * Ajoute une nouvelle configuration de munition.
 */
const addConfigMunition = ({ type, calibre, designation, observation }) => {
  if (!type || !calibre || !designation) {
    return Promise.reject(new Error("Les champs 'type', 'calibre' et 'designation' sont obligatoires."));
  }
  const sql = "INSERT INTO config_munition (type, calibre, designation, observation) VALUES (?, ?, ?, ?)";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, calibre, designation, observation], function(err) {
      if (err) {
        console.error("Erreur add config_munition:", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration de munition ajoutée", id: this.lastID });
    });
  });
};

/**
 * Met à jour une configuration de munition existante.
 */
const updateConfigMunition = ({ id, type, calibre, designation, observation }) => {
  const sql = "UPDATE config_munition SET type = ?, calibre = ?, designation = ?, observation = ? WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, calibre, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur update config_munition:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de munition non trouvée"));
      resolve({ message: "Configuration de munition mise à jour" });
    });
  });
};

/**
 * Supprime une configuration de munition.
 */
const deleteConfigMunition = (id) => {
  const sql = "DELETE FROM config_munition WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur delete config_munition:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration de munition non trouvée"));
      resolve({ message: "Configuration de munition supprimée" });
    });
  });
};

module.exports = {
  getConfigMunition,
  getConfigMunitionById,
  addConfigMunition,
  updateConfigMunition,
  deleteConfigMunition,
  list
};
