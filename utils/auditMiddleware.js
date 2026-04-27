const auditController = require('../controllers/auditController');

/**
 * Middleware pour capturer et auditer les requêtes
 */
const auditMiddleware = (tableName) => {
  return async (req, res, next) => {
    // Sauvegarder les méthodes originales
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Intercepter la réponse
    res.json = function(data) {
      logAuditAction(req, res, tableName, data);
      return originalJson(data);
    };

    res.send = function(data) {
      logAuditAction(req, res, tableName, data);
      return originalSend(data);
    };

    next();
  };
};

const logAuditAction = async (req, res, tableName, responseData) => {
  try {
    // Ne logger que les opérations réussies
    if (res.statusCode >= 400) return;

    const user = req.user;
    if (!user) return;

    let action = null;
    let recordId = null;
    let oldValues = null;
    let newValues = null;

    // Déterminer l'action selon la méthode HTTP
    switch (req.method) {
      case 'POST':
        action = 'CREATE';
        recordId = responseData?.id || responseData?.data?.id;
        newValues = req.body;
        break;

      case 'PUT':
      case 'PATCH':
        action = 'UPDATE';
        recordId = req.params.id;
        oldValues = req._oldRecord; // Sera défini par un autre middleware
        newValues = req.body;
        break;

      case 'DELETE':
        action = req.query.hard === 'true' ? 'DELETE' : 'DELETE'; // Soft ou hard
        recordId = req.params.id;
        oldValues = req._oldRecord;
        break;

      default:
        return; // Ne pas logger GET
    }

    if (!action || !recordId) return;

    // Enregistrer l'audit
    await auditController.logAction({
      tableName,
      recordId,
      action,
      utilisateurId: user.id,
      utilisateurNom: `${user.nom} ${user.prenom}`,
      oldValues,
      newValues,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
  } catch (error) {
    console.error('Erreur audit logging:', error);
    // Ne pas bloquer la requête en cas d'erreur d'audit
  }
};

/**
 * Middleware pour capturer l'état avant modification/suppression
 */
const captureOldRecord = (tableName) => {
  return async (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && req.params.id) {
      const db = require('../database/database');
      
      db.get(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        [req.params.id],
        (err, row) => {
          if (!err && row) {
            req._oldRecord = row;
          }
          next();
        }
      );
    } else {
      next();
    }
  };
};

module.exports = { auditMiddleware, captureOldRecord };
