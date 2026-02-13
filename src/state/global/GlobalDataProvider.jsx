import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalDataContext } from './globalDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'
import { useAccess } from '../access/accessContext.js'

const ADMIN_PASSWORD_KEY = 'studentDashboard.adminPassword.v1'
const ADMIN_PASSWORD_SESSION_KEY = 'studentDashboard.adminPassword.session.v1'
const GLOBAL_TASKS_DRAFT_KEY = 'studentDashboard.globalTasksDraft.v1'

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

function getSessionJSON(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function setSessionJSON(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
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

async function tryLoadGlobalTasksFromApi(adminPassword) {
  const headers = {}
  if (adminPassword && String(adminPassword).trim()) headers['x-admin-password'] = String(adminPassword).trim()

  const resp = await fetch('/api/global-data', { cache: 'no-store', headers })
  if (resp.status === 404) return null
  if (resp.status === 401) {
    const e = new Error('Sessao invalida. Faca login novamente.')
    e.code = 'UNAUTHORIZED'
    throw e
  }

  const data = await resp.json().catch(() => null)
  if (!resp.ok) {
    const msg = data?.error || `Falha ao carregar /api/global-data (HTTP ${resp.status}).`
    throw new Error(msg)
  }
  if (!data?.ok) throw new Error(data?.error || 'Falha ao carregar dados globais (API).')

  return {
    envelope: normalizeEnvelope(data.tasks),
    storageConfigured: Boolean(data.storageConfigured),
    storeKind: data.store || 'api',
    authRequired: Boolean(data.authRequired),
    adminOk: Boolean(data.adminOk),
  }
}

async function saveGlobalTasksToApi(nextEnvelope, adminPassword) {
  const headers = { 'content-type': 'application/json; charset=utf-8' }
  if (adminPassword && String(adminPassword).trim()) headers['x-admin-password'] = String(adminPassword).trim()

  const resp = await fetch('/api/global-data', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ tasks: nextEnvelope }),
  })

  const data = await resp.json().catch(() => null)
  if (!resp.ok || !data?.ok) {
    const msg = data?.error || `Falha ao salvar /api/global-data (HTTP ${resp.status}).`
    throw new Error(msg)
  }

  return {
    envelope: normalizeEnvelope(data.tasks),
    storageConfigured: Boolean(data.storageConfigured),
    storeKind: data.store || 'api',
    authRequired: Boolean(data.authRequired),
    adminOk: Boolean(data.adminOk),
  }
}

export function GlobalDataProvider({ children }) {
  const { refresh: refreshAccess } = useAccess()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState(null)
  const [adminPassword, setAdminPassword] = useState(() => {
    const session = getSessionJSON(ADMIN_PASSWORD_SESSION_KEY, '')
    if (session && String(session).trim()) return session
    return getStoredJSON(ADMIN_PASSWORD_KEY, '')
  })
  const [authRequired, setAuthRequired] = useState(false)
  const [adminOk, setAdminOk] = useState(false)
  const [storageConfigured, setStorageConfigured] = useState(true)
  const [storeKind, setStoreKind] = useState('tarefas-globais.json')
  const [source, setSource] = useState('json')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const fromApi = await tryLoadGlobalTasksFromApi(adminPassword)
      if (fromApi) {
        setTasks(fromApi.envelope)
        setStorageConfigured(fromApi.storageConfigured)
        setStoreKind(fromApi.storeKind)
        setAuthRequired(fromApi.authRequired)
        setAdminOk(fromApi.adminOk)
        setSource('api')
        return
      }

      const loaded = await loadGlobalTasksFromJson()
      const localDraft = getStoredJSON(GLOBAL_TASKS_DRAFT_KEY, null)
      const effective = localDraft ? normalizeEnvelope(localDraft) : loaded
      setTasks(effective)
      setStorageConfigured(true)
      setStoreKind(localDraft ? 'localStorage' : 'tarefas-globais.json')
      setAuthRequired(false)
      setAdminOk(false)
      setSource('json')
    } catch (e) {
      if (e?.code === 'UNAUTHORIZED') {
        await refreshAccess()
      }
      const fallback = localDefaults()
      const localDraft = getStoredJSON(GLOBAL_TASKS_DRAFT_KEY, null)
      setTasks(localDraft ? normalizeEnvelope(localDraft) : fallback.tasks)
      setStorageConfigured(true)
      setStoreKind(localDraft ? 'localStorage' : 'tarefas-globais.json')
      setAuthRequired(false)
      setAdminOk(false)
      setSource('json')
      setError(
        `${e?.message || String(e)} (usando defaults locais - confira se existe public/tarefas-globais.json)`,
      )
    } finally {
      setLoading(false)
    }
  }, [adminPassword, refreshAccess])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (adminPassword && String(adminPassword).trim()) {
      setSessionJSON(ADMIN_PASSWORD_SESSION_KEY, adminPassword)
    } else {
      try {
        sessionStorage.removeItem(ADMIN_PASSWORD_SESSION_KEY)
      } catch {
        // ignore
      }
    }

    // evita persistir senha no localStorage (migracao/back-compat)
    setStoredJSON(ADMIN_PASSWORD_KEY, '')
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
      source,
      authRequired,
      adminOk,
      isAdmin: source === 'api' ? !authRequired || Boolean(adminOk) : true,
      reload,
      async updateGlobalTasks(nextTasks) {
        const normalized = normalizeEnvelope(nextTasks)

        if (source === 'api') {
          const saved = await saveGlobalTasksToApi(normalized, adminPassword)
          setTasks(saved.envelope)
          setStorageConfigured(saved.storageConfigured)
          setStoreKind(saved.storeKind)
          setAuthRequired(saved.authRequired)
          setAdminOk(saved.adminOk)
          return saved.envelope
        }

        setTasks(normalized)
        setStoredJSON(GLOBAL_TASKS_DRAFT_KEY, normalized)
        setStorageConfigured(true)
        setStoreKind('localStorage')
        return normalized
      },
    }
  }, [adminOk, adminPassword, authRequired, error, loading, reload, source, storageConfigured, storeKind, tasks])

  return <GlobalDataContext.Provider value={api}>{children}</GlobalDataContext.Provider>
}
