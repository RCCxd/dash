import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalDataContext } from './globalDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'

const ADMIN_PASSWORD_KEY = 'studentDashboard.adminPassword.v1'

function localDefaults() {
  return {
    tasks: { tasks: [] },
  }
}

function normalizeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return { tasks: [] }
  const tasks = Array.isArray(envelope.tasks) ? envelope.tasks : []
  return { ...envelope, tasks }
}

function globalTasksUrl() {
  const base = String(import.meta?.env?.BASE_URL || '/')
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}tarefas-globais.json`
}

async function loadGlobalTasksFromJson() {
  const url = globalTasksUrl()
  const resp = await fetch(url, { cache: 'no-store' })
  if (!resp.ok) {
    throw new Error(`Falha ao carregar tarefas globais em ${url} (HTTP ${resp.status}).`)
  }
  const data = await resp.json()
  return normalizeEnvelope(data)
}

export function GlobalDataProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState(null)
  const [adminPassword, setAdminPassword] = useState(() => getStoredJSON(ADMIN_PASSWORD_KEY, ''))
  const [authRequired, setAuthRequired] = useState(false)
  const [adminOk, setAdminOk] = useState(false)
  const [storageConfigured, setStorageConfigured] = useState(true)
  const [storeKind, setStoreKind] = useState('tarefas-globais.json')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadGlobalTasksFromJson()
      setTasks(loaded)
      setStorageConfigured(true)
      setStoreKind('tarefas-globais.json')
      setAuthRequired(false)
      setAdminOk(true)
    } catch (e) {
      const fallback = localDefaults()
      setTasks(fallback.tasks)
      setStorageConfigured(true)
      setStoreKind('tarefas-globais.json')
      setAuthRequired(false)
      setAdminOk(false)
      setError(
        `${e?.message || String(e)} (usando defaults locais — confira se existe public/tarefas-globais.json)`,
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
      tasks,
      adminPassword,
      setAdminPassword,
      storageConfigured,
      storeKind,
      authRequired,
      adminOk,
      isAdmin: authRequired ? Boolean(adminOk) : Boolean(adminPassword && String(adminPassword).trim()),
      reload,
      async updateGlobalTasks(nextTasks) {
        const normalized = normalizeEnvelope(nextTasks)
        setTasks(normalized)
        setAuthRequired(false)
        setAdminOk(true)
        return normalized
      },
    }
  }, [adminPassword, adminOk, authRequired, error, loading, reload, tasks, storageConfigured, storeKind])

  return <GlobalDataContext.Provider value={api}>{children}</GlobalDataContext.Provider>
}

