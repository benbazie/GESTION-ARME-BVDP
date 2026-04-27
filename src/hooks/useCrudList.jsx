import { useCallback, useState } from 'react'
import api from '../api'

const toPascal = (name) =>
  name
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

const isElectron = () =>
  typeof window !== 'undefined' && !!window.electronAPI

const apiToUse = (window.electronAPI && typeof window.electronAPI.call === "function")
  ? window.electronAPI
  : (window.api && typeof window.api.call === "function")
  ? window.api
  : null;

export default function useCrudList(resource) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (params) => {
    setLoading(true)
    try {
      let data
      if (isElectron()) {
        data = await apiToUse.call(`get${toPascal(resource)}List`, params);
      } else {
        const method = `get${toPascal(resource)}List`
        data =
          typeof api[method] === 'function'
            ? await api[method](params)
            : await api.get(resource, params)
      }
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(`useCrudList load ${resource}`, err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [resource])

  const remove = useCallback(async (id) => {
    try {
      if (isElectron()) {
        await apiToUse.call(`delete${toPascal(resource)}`, id);
      } else {
        const method = `delete${toPascal(resource)}`
        if (typeof api[method] === 'function') await api[method](id)
        else await api.delete(`/${resource}/${id}`)
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      console.error(`useCrudList delete ${resource}`, err)
      throw err
    }
  }, [resource])

  return { items, loading, load, remove }
}
