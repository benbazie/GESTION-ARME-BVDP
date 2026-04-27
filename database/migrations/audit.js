const createAuditTable = (db) => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
        utilisateur_id INTEGER,
        utilisateur_nom TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
      )
    `, (err) => {
      if (err) reject(err);
      else {
        // Index pour performances
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name)`, () => {
          db.run(`CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id)`, () => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(utilisateur_id)`, () => {
              db.run(`CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at)`, () => {
                resolve();
              });
            });
          });
        });
      }
    });
  });
};

module.exports = { createAuditTable };
