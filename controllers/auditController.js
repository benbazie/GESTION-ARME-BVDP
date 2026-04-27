const db = require('../database/database');

const AUDITED_TABLES = [
  'armes',
  'munitions',
  'optiques',
  'materiels_specifiques',
  'vdps',
  'dotations',
  'mouvements_armes',
  'mouvements_munitions',
  'stocks_armes',
  'stocks_munitions'
];

const auditController = {
  /**
   * Enregistre une action dans le journal d'audit
   */
  logAction: async (params) => {
    const {
      tableName,
      recordId,
      action,
      utilisateurId,
      utilisateurNom,
      oldValues = null,
      newValues = null,
      ipAddress = null,
      userAgent = null
    } = params;

    if (!AUDITED_TABLES.includes(tableName)) {
      return; // Ne pas auditer les tables non configurées
    }

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_logs 
        (table_name, record_id, action, utilisateur_id, utilisateur_nom, 
         old_values, new_values, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tableName,
          recordId,
          action,
          utilisateurId,
          utilisateurNom,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress,
          userAgent
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  },

  /**
   * Récupère l'historique d'audit pour une table spécifique
   */
  getTableAudit: async (req, res) => {
    try {
      const { table } = req.params;
      const { recordId, startDate, endDate, action, utilisateurId, limit = 100, offset = 0 } = req.query;

      if (!AUDITED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Table non auditée' });
      }

      let sql = `
        SELECT 
          al.*,
          u.nom as utilisateur_nom_complet,
          u.prenom as utilisateur_prenom
        FROM audit_logs al
        LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
        WHERE al.table_name = ?
      `;
      const params = [table];

      if (recordId) {
        sql += ` AND al.record_id = ?`;
        params.push(recordId);
      }

      if (startDate) {
        sql += ` AND al.created_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND al.created_at <= ?`;
        params.push(endDate);
      }

      if (action) {
        sql += ` AND al.action = ?`;
        params.push(action);
      }

      if (utilisateurId) {
        sql += ` AND al.utilisateur_id = ?`;
        params.push(utilisateurId);
      }

      sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Erreur récupération audit:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        // Parser les JSON
        const logs = rows.map(row => ({
          ...row,
          old_values: row.old_values ? JSON.parse(row.old_values) : null,
          new_values: row.new_values ? JSON.parse(row.new_values) : null
        }));

        res.json(logs);
      });
    } catch (error) {
      console.error('Erreur getTableAudit:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Récupère l'historique complet d'un enregistrement
   */
  getRecordHistory: async (req, res) => {
    try {
      const { table, id } = req.params;

      if (!AUDITED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Table non auditée' });
      }

      db.all(
        `SELECT 
          al.*,
          u.nom as utilisateur_nom_complet,
          u.prenom as utilisateur_prenom
        FROM audit_logs al
        LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
        WHERE al.table_name = ? AND al.record_id = ?
        ORDER BY al.created_at DESC`,
        [table, id],
        (err, rows) => {
          if (err) {
            console.error('Erreur récupération historique:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
          }

          const logs = rows.map(row => ({
            ...row,
            old_values: row.old_values ? JSON.parse(row.old_values) : null,
            new_values: row.new_values ? JSON.parse(row.new_values) : null
          }));

          res.json(logs);
        }
      );
    } catch (error) {
      console.error('Erreur getRecordHistory:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Tableau de bord d'activité
   */
  getDashboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      let dateFilter = '';
      const params = [];

      if (startDate) {
        dateFilter += ` AND created_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        dateFilter += ` AND created_at <= ?`;
        params.push(endDate);
      }

      // Statistiques par table
      const tableStats = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            table_name,
            action,
            COUNT(*) as count
          FROM audit_logs
          WHERE 1=1 ${dateFilter}
          GROUP BY table_name, action
          ORDER BY table_name, action`,
          params,
          (err, rows) => err ? reject(err) : resolve(rows)
        );
      });

      // Utilisateurs les plus actifs
      const topUsers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            utilisateur_id,
            utilisateur_nom,
            COUNT(*) as actions_count
          FROM audit_logs
          WHERE utilisateur_id IS NOT NULL ${dateFilter}
          GROUP BY utilisateur_id, utilisateur_nom
          ORDER BY actions_count DESC
          LIMIT 10`,
          params,
          (err, rows) => err ? reject(err) : resolve(rows)
        );
      });

      // Activité récente
      const recentActivity = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            al.*,
            u.nom as utilisateur_nom_complet,
            u.prenom as utilisateur_prenom
          FROM audit_logs al
          LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
          WHERE 1=1 ${dateFilter}
          ORDER BY al.created_at DESC
          LIMIT 20`,
          params,
          (err, rows) => err ? reject(err) : resolve(rows)
        );
      });

      res.json({
        tableStats,
        topUsers,
        recentActivity: recentActivity.map(row => ({
          ...row,
          old_values: row.old_values ? JSON.parse(row.old_values) : null,
          new_values: row.new_values ? JSON.parse(row.new_values) : null
        }))
      });
    } catch (error) {
      console.error('Erreur getDashboard:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * Détails enrichis d'une arme + historique d'audit (si présent)
   */
  getArmeDetail: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'id requis' });

      db.get('SELECT * FROM armes WHERE id = ?', [id], (armeErr, armeRow) => {
        if (armeErr) {
          console.error('Erreur getArmeDetail (arme):', armeErr);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        db.all(
          `SELECT *
           FROM audit_logs
           WHERE table_name = 'armes' AND record_id = ?
           ORDER BY created_at DESC`,
          [id],
          (logErr, rows) => {
            if (logErr) {
              console.error('Erreur getArmeDetail (audit_logs):', logErr);
              return res.status(500).json({ error: 'Erreur serveur' });
            }

            const logs = (rows || []).map((row) => ({
              ...row,
              old_values: row.old_values ? JSON.parse(row.old_values) : null,
              new_values: row.new_values ? JSON.parse(row.new_values) : null,
            }));

            res.json({
              arme: armeRow || null,
              audit: logs,
            });
          }
        );
      });
    } catch (error) {
      console.error('Erreur getArmeDetail:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
};

module.exports = auditController;
