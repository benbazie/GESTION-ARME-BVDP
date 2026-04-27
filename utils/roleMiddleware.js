// utils/roleMiddleware.js — version temporaire pour tests
'use strict'

/**
 * Middleware temporaire qui autorise toutes les requêtes
 * sans vérifier les rôles ou permissions.
 *
 * @returns {Function} Middleware Express
 */
module.exports = (..._allowedRoles) => {
  return (req, res, next) => {
    // On simule un utilisateur avec un rôle superadmin si besoin
    if (!req.user) {
      req.user = { id: 1, username: 'test', roles: ['superadmin'], permissions: ['ALL'] }
    }
    next()
  }
}
