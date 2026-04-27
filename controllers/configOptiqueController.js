const db = require('../database/database.js');

const getConfigOptique = () => {
  const sql = "SELECT * FROM config_optique";
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Erreur get config_optique:", err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
};

const list = (req, res) => {
  getConfigOptique()
    .then(rows => res.json(rows))
    .catch(err => {
      console.error("Erreur list config_optique:", err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    });
};

const getConfigOptiqueById = (id) => {
  const sql = "SELECT * FROM config_optique WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error("Erreur get config_optique by id:", err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
};

const addConfigOptique = ({ type, categorie, designation, observation }) => {
  if (!type || !categorie || !designation) {
    return Promise.reject(new Error("Les champs 'type', 'categorie' et 'designation' sont obligatoires."));
  }
  const sql = "INSERT INTO config_optique (type, categorie, designation, observation) VALUES (?, ?, ?, ?)";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation], function(err) {
      if (err) {
        console.error("Erreur add config_optique:", err.message);
        return reject(err);
      }
      resolve({ message: "Configuration d'optique ajoutée", id: this.lastID });
    });
  });
};

const updateConfigOptique = ({ id, type, categorie, designation, observation }) => {
  const sql = "UPDATE config_optique SET type = ?, categorie = ?, designation = ?, observation = ? WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [type, categorie, designation, observation, id], function(err) {
      if (err) {
        console.error("Erreur update config_optique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'optique non trouvée"));
      resolve({ message: "Configuration d'optique mise à jour" });
    });
  });
};

const deleteConfigOptique = (id) => {
  const sql = "DELETE FROM config_optique WHERE id = ?";
  return new Promise((resolve, reject) => {
    db.run(sql, [id], function(err) {
      if (err) {
        console.error("Erreur delete config_optique:", err.message);
        return reject(err);
      }
      if (this.changes === 0) return reject(new Error("Configuration d'optique non trouvée"));
      resolve({ message: "Configuration d'optique supprimée" });
    });
  });
};

module.exports = {
  getConfigOptique,
  getConfigOptiqueById,
  addConfigOptique,
  updateConfigOptique,
  deleteConfigOptique,
  list
};
