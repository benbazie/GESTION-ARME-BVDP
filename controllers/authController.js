// controllers/authController.js
'use strict';

const db = require('../database/database');
const crypto = require('crypto');

const sessionController = require('./sessionController');

const TABLE_USERS = 'utilisateurs';
const TABLE_SESSIONS = 'sessions';

const nowISO = () => new Date().toISOString();

// Fonction utilitaire pour hacher un mot de passe
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Génération d’un token de session
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  /**
   * Connexion utilisateur
   */
  async login({ body }) {
    const { username, password } = body;
    if (!username || !password) {
      throw new Error('Champs "username" et "password" obligatoires');
    }

    // Vérifier l'utilisateur
    const user = await db.get(
      `SELECT * FROM ${TABLE_USERS} WHERE username = ?`,
      [username]
    );
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    // Vérifier le mot de passe
    const hashed = hashPassword(password);
    if (user.password_hash !== hashed) {
      throw new Error('Mot de passe incorrect');
    }

    // Créer une session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h
    const session = await sessionController.add({
      body: {
        utilisateur_id: user.id,
        token,
        expires_at: expiresAt
      }
    });

    return {
      message: 'Connexion réussie',
      utilisateur: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        username: user.username,
        role_id: user.role_id
      },
      token: session.token,
      expires_at: session.expires_at
    };
  },

  /**
   * Déconnexion utilisateur
   */
  async logout({ body }) {
    const { token } = body;
    if (!token) {
      throw new Error('Token obligatoire pour la déconnexion');
    }

    // Supprimer la session
    await db.run(`DELETE FROM ${TABLE_SESSIONS} WHERE token = ?`, [token]);
    return { message: 'Déconnexion réussie' };
  },

  /**
   * Vérification de token (middleware possible)
   */
  async verifyToken({ token }) {
    if (!token) return null;

    const session = await db.get(
      `SELECT s.*, u.nom, u.prenom, u.username, u.role_id
       FROM ${TABLE_SESSIONS} s
       LEFT JOIN ${TABLE_USERS} u ON s.utilisateur_id = u.id
       WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > ?)`,
      [token, nowISO()]
    );

    return session || null;
  }
};
