import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'

const PRIMARY_TOKEN_KEY   = 'auth-token'
const LEGACY_TOKEN_KEY    = 'auth_token'

function getStoredToken() {
  return (
    localStorage.getItem(PRIMARY_TOKEN_KEY) ||
    localStorage.getItem(LEGACY_TOKEN_KEY) ||
    null
  )
}

function storeToken(token) {
  if (!token) return
  try {
    localStorage.setItem(PRIMARY_TOKEN_KEY, token)
    localStorage.setItem(LEGACY_TOKEN_KEY, token)
  } catch {}
}

function clearStoredToken() {
  try {
    localStorage.removeItem(PRIMARY_TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {}
}

export default function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔐 login
  const login = useCallback(async (credentials) => {
    try {
      const { token, user } = await window.electronAPI.login(credentials)
      if (!token || !user) throw new Error('Authentification échouée')
      storeToken(token)   // double verrou pour le renderer
      setUser(user)
      return user
    } catch (err) {
      const msg = err.payload?.error || err.message || 'Erreur inconnue'
      message.error(`Échec de connexion : ${msg}`)
      throw err
    }
  }, [])

  // 🧼 logout
  const logout = useCallback(async () => {
    try {
      await window.electronAPI.logout()
    } catch {}
    clearStoredToken()
    setUser(null)
  }, [])

  // 👤 me()
  const fetchMe = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await window.electronAPI.me()
      setUser(me || null)
    } catch {
      clearStoredToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // 🔄 auto-load au démarrage
  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    reload: fetchMe
  }
}
