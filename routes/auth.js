'use strict'
const express = require('express')
const jwt     = require('jsonwebtoken')
const bcrypt  = require('bcryptjs')
const router  = express.Router()
const authMiddleware = require('../utils/authMiddleware')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env')
  process.exit(1)
}

const ADMIN_ROLE_NAMES = new Set(['admin', 'role_admin'])

const isAdminLike = (roleName = '') => {
  const normalized = String(roleName || '').trim().toLowerCase()
  if (!normalized) return false
  if (ADMIN_ROLE_NAMES.has(normalized)) return true
  return normalized.includes('admin') // couvre "administrateur", "administration", etc.
}

function normalizePermissions(rawPermissions, roleName = '') {
  const grantAllFallback = () => (isAdminLike(roleName) ? ['*'] : [])

  if (Array.isArray(rawPermissions)) {
    const normalized = rawPermissions
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => typeof value === 'string' && value.length > 0)
    if (normalized.length > 0) return normalized
    return grantAllFallback()
  }

  if (rawPermissions == null) {
    return grantAllFallback()
  }

  if (typeof rawPermissions === 'string') {
    const trimmed = rawPermissions.trim()
    if (!trimmed) {
      return grantAllFallback()
    }

    const upper = trimmed.toUpperCase()
    if (upper === 'ALL' || upper === '[OBJECT OBJECT]') {
      return ['*']
    }

    try {
      const parsed = JSON.parse(trimmed)
      const normalized = normalizePermissions(parsed, roleName)
      if (normalized.length > 0) return normalized
    } catch (err) {
      // ignore JSON parse failure and continue fallback strategies
    }

    if (trimmed.includes(',')) {
      const values = trimmed
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      if (values.length > 0) return values
    }
  }

  return grantAllFallback()
}

// === POST /api/auth/login ===
router.post('/login', (req, res) => {
  const db = req.app.locals.db
  const { username, password } = req.body

  if (!db) {
    return res.status(500).json({ error: 'Base de données non disponible' })
  }

  db.get(
    `SELECT 
       u.id, 
       u.username, 
       u.password_hash AS hash, 
       u.role_id,
       u.entite_id,
       u.sous_entite_id,
       u.coordination_regionale_id,
       u.coordination_provinciale_id,
       u.coordination_communale_id,
       r.nom  AS role_nom,
       r.permissions AS role_permissions
     FROM utilisateurs u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.username = ?`,
    [username.trim()],
    async (err, user) => {
      if (err) {
        console.error('SQL login error:', err.message)
        return res.status(500).json({ error: 'Erreur interne BD' })
      }
      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' })
      }

      try {
        const match = await bcrypt.compare(password, user.hash)
        if (!match) {
          return res.status(401).json({ error: 'Identifiants invalides' })
        }

        const roles = user.role_nom ? [user.role_nom] : []
        const permissions = normalizePermissions(user.role_permissions, user.role_nom)

        const payload = { 
          id: user.id, 
          username: user.username, 
          role_id: user.role_id, 
          roles,
          permissions,
          entite_id: user.entite_id ?? null,
          sous_entite_id: user.sous_entite_id ?? null,
          coordination_regionale_id: user.coordination_regionale_id ?? null,
          coordination_provinciale_id: user.coordination_provinciale_id ?? null,
          coordination_communale_id: user.coordination_communale_id ?? null,
        }

        const token = jwt.sign(payload, JWT_SECRET, { 
          expiresIn: process.env.JWT_EXPIRES_IN || '8h' 
        })

        res.json({ token, user: payload })
      } catch (compareErr) {
        console.error('Erreur bcrypt:', compareErr.message)
        res.status(500).json({ error: 'Erreur interne' })
      }
    }
  )
})

// === GET /api/auth/me ===
router.get('/me', authMiddleware, (req, res) => {
  const db = req.app.locals.db

  db.get(
    `SELECT 
       u.id, 
       u.username, 
       u.role_id, 
       u.entite_id,
       u.sous_entite_id,
       u.coordination_regionale_id,
       u.coordination_provinciale_id,
       u.coordination_communale_id,
       r.nom AS role_nom, 
       r.permissions AS role_permissions
     FROM utilisateurs u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Erreur SQL /auth/me:', err.message)
        return res.status(500).json({ error: 'Erreur interne BD' })
      }
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur introuvable' })
      }

      const permissions = normalizePermissions(user.role_permissions, user.role_nom)

      res.json({
        id: user.id,
        username: user.username,
        role_id: user.role_id,
        roles: user.role_nom ? [user.role_nom] : [],
        permissions,
        entite_id: user.entite_id ?? null,
        sous_entite_id: user.sous_entite_id ?? null,
        coordination_regionale_id: user.coordination_regionale_id ?? null,
        coordination_provinciale_id: user.coordination_provinciale_id ?? null,
        coordination_communale_id: user.coordination_communale_id ?? null,
      })
    }
  )
})

module.exports = router
