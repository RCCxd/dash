import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalDataContext } from './globalDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'

const ADMIN_PASSWORD_KEY = 'studentDashboard.adminPassword.v1'

function localDefaults() {
  return {
    tasks: { tasks: [] },
  }
}

async function apiGet({ adminPassword } = {}) {
  const resp = await fetch('/api/global-data', {
    method: 'GET',
    headers: {
      ...(adminPassword && String(adminPassword).trim()
        ? { 'x-admin-password': String(adminPassword).trim() }
        : null),
    },
  })
  const data = await resp.json()
  if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha ao carregar dados globais.')
  return data
}

async function apiPutPartial({ patch, adminPassword }) {
  const resp = await fetch('/api/global-data', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(adminPassword && String(adminPassword).trim()
        ? { 'x-admin-password': String(adminPassword).trim() }
        : null),
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
  const [tasks, setTasks] = useState(null)
  const [adminPassword, setAdminPassword] = useState(() => getStoredJSON(ADMIN_PASSWORD_KEY, ''))
  const [authRequired, setAuthRequired] = useState(false)
  const [adminOk, setAdminOk] = useState(false)
  const [storageConfigured, setStorageConfigured] = useState(true)
  const [storeKind, setStoreKind] = useState('unknown')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet({ adminPassword })
      setTasks(data.tasks)
      setStorageConfigured(Boolean(data.storageConfigured ?? true))
      setStoreKind(String(data.store || 'unknown'))
      setAuthRequired(Boolean(data.authRequired))
      setAdminOk(Boolean(data.adminOk))
    } catch (e) {
      const fallback = localDefaults()
      setTasks(fallback.tasks)
      setAuthRequired(false)
      setAdminOk(false)
      setError(
        `${e?.message || String(e)} (usando defaults locais — para dados globais, rode via Vercel Functions: vercel dev)`,
      )
    } finally {
      setLoading(false)
    }
  }, [adminPassword])

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
        const data = await apiPutPartial({ patch: { tasks: nextTasks }, adminPassword })
        setTasks(data.tasks)
        setAuthRequired(Boolean(data.authRequired))
        setAdminOk(Boolean(data.adminOk))
        return data.tasks
      },
    }
  }, [
    adminPassword,
    adminOk,
    authRequired,
    error,
    loading,
    reload,
    tasks,
    storageConfigured,
    storeKind,
  ])

  return <GlobalDataContext.Provider value={api}>{children}</GlobalDataContext.Provider>
}
