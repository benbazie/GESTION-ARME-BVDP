const db = require('../database/database.js');

/**
 * Récupère toutes les configurations d'arme.
 */
const getConfigArme = () => {
  const sql = "SELECT * FROM config_arme";
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur get config_arme:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
};

/**
 * Liste toutes les configurations d'arme (API REST).
 */
const list = (req, res) => {
  getConfigArme()
    .then(rows => res.json(rows))
    .catch(err => {
      console.error("Erreur list config_arme:", err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    });
};

const getConfigArmeById = (id) => {
  const sql = "SELECT * FROM config_arme WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur get config_arme by id:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
};

const addConfigArme = ({ type, categorie, designation, observation }) => {
  if (!type || !categorie || !designation) {
    return Promise.reject(new Error("Les champs 'type', 'categorie' et 'designation' sont obligatoires."));
  }
  const sql = "INSERT INTO config_arme (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur add config_arme:", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration d'arme ajoutée", id: this.lastID });
    });
  });
};

const updateConfigArme = ({ id, type, categorie, designation, observation }) => {
  const sql = "UPDATE config_arme SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur update config_arme:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'arme non trouvée"));
      resolve({ message: "Configuration d'arme mise à jour" });
    });
  });
};

const deleteConfigArme = (id) => {
  const sql = "DELETE FROM config_arme WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur delete config_arme:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'arme non trouvée"));
      resolve({ message: "Configuration d'arme supprimée" });
    });
  });
};

module.exports = {
  getConfigArme,
  getConfigArmeById,
  addConfigArme,
  updateConfigArme,
  deleteConfigArme,
  list
};
