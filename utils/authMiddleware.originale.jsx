'use strict'
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env')
  process.exit(1)
}

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou mal formé' })
  }

  const token = authHeader.slice(7)

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch (err) {
    console.warn('❌ JWT invalide →', err.message)
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }

  req.user = {
    id: payload.id,
    username: payload.username,
    role_id: payload.role_id,
    roles: [],
    permissions: []
  }

  const db = req.app.locals.db
  const sql = `
    SELECT r.nom AS role, r.permissions
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
  `
  db.all(sql, [payload.id], (err, rows) => {
    if (err) {
      console.error('❌ Erreur chargement rôles:', err.message)
      return res.status(500).json({ error: 'Erreur serveur' })
    }

    req.user.roles = rows.map(r => r.role)

    const perms = rows.flatMap(r => {
      try {
        return JSON.parse(r.permissions || '[]')
      } catch {
        return (r.permissions || '')
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
      }
    })
    req.user.permissions = Array.from(new Set(perms))

    next()
  })
}
