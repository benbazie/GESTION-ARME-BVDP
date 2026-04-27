'use strict'
const jwt = require('jsonwebtoken')
const { extractScope } = require('./scope')

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization']
  let token = null
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7)
    else token = authHeader
  }

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré' })
    }
    req.user = user
    req.scope = extractScope(user)
    next()
  })
}
