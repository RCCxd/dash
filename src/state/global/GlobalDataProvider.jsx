import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalDataContext } from './globalDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'

const ADMIN_PASSWORD_KEY = 'studentDashboard.adminPassword.v1'

function localDefaults() {
  return {
    routine: { events: [] },
    tasks: { tasks: [] },
  }
}

async function apiGet() {
  const resp = await fetch('/api/global-data', { method: 'GET' })
  const data = await resp.json()
  if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha ao carregar dados globais.')
  return data
}

async function apiPutPartial({ patch }) {
  const resp = await fetch('/api/global-data', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(patch),
  })
  const data = await resp.json()
  if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha ao salvar dados globais.')
  return data
}

export function GlobalDataProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routine, setRoutine] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [adminPassword, setAdminPassword] = useState(() => getStoredJSON(ADMIN_PASSWORD_KEY, ''))
  const [storageConfigured, setStorageConfigured] = useState(true)
  const [storeKind, setStoreKind] = useState('unknown')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet()
      setRoutine(data.routine)
      setTasks(data.tasks)
      setStorageConfigured(Boolean(data.storageConfigured ?? true))
      setStoreKind(String(data.store || 'unknown'))
    } catch (e) {
      const fallback = localDefaults()
      setRoutine(fallback.routine)
      setTasks(fallback.tasks)
      setError(
        `${e?.message || String(e)} (usando defaults locais — para dados globais e IA, rode via Vercel Functions: vercel dev)`,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    setStoredJSON(ADMIN_PASSWORD_KEY, adminPassword || '')
  }, [adminPassword])

  const api = useMemo(() => {
    return {
      loading,
      error,
      routine,
      tasks,
      adminPassword,
      setAdminPassword,
      storageConfigured,
      storeKind,
      isAdmin: Boolean(adminPassword && String(adminPassword).trim()),
      reload,
      async updateGlobalRoutine(nextRoutine) {
        const data = await apiPutPartial({ patch: { routine: nextRoutine } })
        setRoutine(data.routine)
        return data.routine
      },
      async updateGlobalTasks(nextTasks) {
        const data = await apiPutPartial({ patch: { tasks: nextTasks } })
        setTasks(data.tasks)
        return data.tasks
      },
    }
  }, [
    adminPassword,
    error,
    loading,
    reload,
    routine,
    tasks,
    storageConfigured,
    storeKind,
  ])

  return <GlobalDataContext.Provider value={api}>{children}</GlobalDataContext.Provider>
}
