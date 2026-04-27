import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { setToken } from '../api'

const AuthContext = createContext({
  user:    null,
  login:   async () => {},
  logout:  async () => {},
  loading: true
})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Utilitaire pour choisir la bonne API selon l'environnement et la présence de la méthode
  function getAPIWithMethod(method) {
    if (
      window.electronAPI &&
      typeof window.electronAPI[method] === 'function'
    ) {
      return window.electronAPI
    }
    return api
  }

  // 🔄 Restaure la session au démarrage
  useEffect(() => {
    ;(async () => {
      try {
        const apiToUse = getAPIWithMethod('me')
        if (typeof apiToUse.me !== 'function') throw new Error('API.me non disponible')
        const profile = await apiToUse.me()
        if (profile && profile.id) {
          setUser(profile)
        } else {
          const clear = getAPIWithMethod('clearToken')
          clear.clearToken && clear.clearToken()
          setUser(null)
        }
      } catch (err) {
        console.warn('[Auth] session invalide', err)
        const clear = getAPIWithMethod('clearToken')
        clear.clearToken && clear.clearToken()
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // 🔐 Connexion
  const login = useCallback(async ({ username, password }) => {
    if (!username || !password) {
      throw new Error('Identifiant et mot de passe requis')
    }
    console.log('[AuthContext] login →', { username, password })
    const apiToUse = getAPIWithMethod('login')
    const data = await apiToUse.login({ username, password })
    if (!data.token) {
      throw new Error('Aucun token renvoyé')
    }
    const profile = data.user || data
    try {
      localStorage.setItem('auth-token', data.token)
      localStorage.setItem('auth_token', data.token)
    } catch {}
    setToken(data.token);
    // Rafraîchit le profil depuis /me pour obtenir les permissions calculées côté serveur
    try {
      const meApi = getAPIWithMethod('me')
      if (typeof meApi.me === 'function') {
        const fresh = await meApi.me()
        if (fresh && fresh.id) {
          setUser(fresh)
          return fresh
        }
      }
    } catch (_) {
      // ignore, on garde le profil retourné par login
    }

    setUser(profile)
    return profile
  }, [])

  // 🧼 Déconnexion
  const logout = useCallback(async () => {
    try {
      const apiToUse = getAPIWithMethod('logout')
      await apiToUse.logout()
    } catch {}
    const clear = getAPIWithMethod('clearToken')
    clear.clearToken && clear.clearToken()
    try {
      localStorage.removeItem('auth-token')
      localStorage.removeItem('auth_token')
    } catch {}
    setToken(null);
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
