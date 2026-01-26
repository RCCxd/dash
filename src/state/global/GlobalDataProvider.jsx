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

async function apiAdminAuth({ adminPassword }) {
  const resp = await fetch('/api/global-data', {
    method: 'POST',
    headers: {
      'x-admin-password': adminPassword,
    },
  })
  const data = await resp.json()
  if (!resp.ok || !data.ok) {
    const err = new Error(data.error || 'Falha ao autenticar admin.')
    err.code = data.code
    err.status = resp.status
    throw err
  }
  return data
}

async function apiAdminSetup({ password }) {
  const resp = await fetch('/api/global-data', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'setup', password }),
  })
  const data = await resp.json()
  if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha ao configurar admin.')
  return data
}

async function apiPutPartial({ adminPassword, patch }) {
  const resp = await fetch('/api/global-data', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-password': adminPassword,
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
  const [adminVerified, setAdminVerified] = useState(false)
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminAuthError, setAdminAuthError] = useState('')
  const [adminConfigured, setAdminConfigured] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet()
      setRoutine(data.routine)
      setTasks(data.tasks)
      setAdminConfigured(Boolean(data.adminConfigured))
    } catch (e) {
      const fallback = localDefaults()
      setRoutine(fallback.routine)
      setTasks(fallback.tasks)
      setError(
        `${e?.message || String(e)} (usando defaults locais — para dados globais e IA, rode via Netlify Functions)`,
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

  useEffect(() => {
    if (!adminPassword) {
      setAdminVerified(false)
      setAdminAuthError('')
      return
    }
    let cancelled = false
    setAdminBusy(true)
    setAdminAuthError('')
    apiAdminAuth({ adminPassword })
      .then(() => {
        if (cancelled) return
        setAdminVerified(true)
      })
      .catch((e) => {
        if (cancelled) return
        setAdminVerified(false)
        setAdminAuthError(e?.message || String(e))
      })
      .finally(() => {
        if (cancelled) return
        setAdminBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [adminPassword])

  const api = useMemo(() => {
    return {
      loading,
      error,
      routine,
      tasks,
      adminPassword,
      adminConfigured,
      adminBusy,
      adminAuthError,
      isAdmin: Boolean(adminVerified),
      async signInAdmin(password) {
        const p = String(password || '')
        if (!p) return false
        setAdminBusy(true)
        setAdminAuthError('')
        try {
          await apiAdminAuth({ adminPassword: p })
          setAdminPassword(p)
          setAdminVerified(true)
          return true
        } catch (e) {
          const code = e?.code
          if (code === 'ADMIN_NOT_CONFIGURED' || e?.status === 428) {
            await apiAdminSetup({ password: p })
            await apiAdminAuth({ adminPassword: p })
            setAdminPassword(p)
            setAdminVerified(true)
            setAdminConfigured(true)
            return true
          }
          setAdminVerified(false)
          setAdminPassword('')
          setAdminAuthError(e?.message || String(e))
          return false
        } finally {
          setAdminBusy(false)
        }
      },
      signOutAdmin() {
        setAdminPassword('')
        setAdminVerified(false)
        setAdminAuthError('')
      },
      reload,
      async updateGlobalRoutine(nextRoutine) {
        if (!adminVerified) throw new Error('Entre como admin para salvar.')
        const data = await apiPutPartial({ adminPassword, patch: { routine: nextRoutine } })
        setRoutine(data.routine)
        return data.routine
      },
      async updateGlobalTasks(nextTasks) {
        if (!adminVerified) throw new Error('Entre como admin para salvar.')
        const data = await apiPutPartial({ adminPassword, patch: { tasks: nextTasks } })
        setTasks(data.tasks)
        return data.tasks
      },
    }
  }, [adminConfigured, adminBusy, adminPassword, adminAuthError, adminVerified, error, loading, reload, routine, tasks])

  return <GlobalDataContext.Provider value={api}>{children}</GlobalDataContext.Provider>
}
