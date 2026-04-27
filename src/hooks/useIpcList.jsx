import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'

/**
 * Hook pour charger une liste via IPC
 * @param {string} ipcName — nom du handler exposé via preload (ex: 'getLocalitesList')
 * @param {any}    params  — paramètres optionnels pour la requête GET (query)
 */
export default function useIpcList(ipcName, params = null) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // 1) Récupérer le token via preload (plus fiable que localStorage direct)
      const token = window.electronAPI.getToken?.() || localStorage.getItem('token')
      if (!token) {
        message.warning('Session expirée ou token manquant')
        setData([])
        return
      }

      // 2) Appeler la méthode IPC exposée dans preload.js
      const list = await window.electronAPI[ipcName](params, token)
      setData(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error(`[useIpcList:${ipcName}]`, err)
      const msg = err.payload?.error || err.message || 'Erreur inconnue'
      message.error(`Échec de chargement : ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [ipcName, params])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, reload }
}
