import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessContext } from './accessContext.js'

const DEVICE_ID_KEY = 'studentDashboard.deviceId.v1'

function getStoredDeviceId() {
  try {
    return localStorage.getItem(DEVICE_ID_KEY) || ''
  } catch {
    return ''
  }
}

function createDeviceId() {
  const fromStorage = getStoredDeviceId()
  if (fromStorage) return fromStorage

  let next = ''
  try {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    next = Array.from(arr)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    next = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }

  try {
    localStorage.setItem(DEVICE_ID_KEY, next)
  } catch {
    // ignore
  }
  return next
}

async function parseJson(resp) {
  try {
    return await resp.json()
  } catch {
    return null
  }
}

export function AccessProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  const authSnapshotRef = useRef({ authenticated: false })

  useEffect(() => {
    authSnapshotRef.current = { authenticated: Boolean(authenticated) }
  }, [authenticated])

  const refresh = useCallback(async () => {
    setError('')
    try {
      const resp = await fetch('/api/access', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })

      if (resp.status === 404) {
        setAuthEnabled(false)
        setAuthenticated(true)
        setAccount(null)
        return
      }

      const data = await parseJson(resp)
      if (resp.status === 401 || resp.status === 403) {
        setAuthEnabled(true)
        setAuthenticated(false)
        setAccount(null)
        setError(data?.error || 'Sessao invalida. Faca login novamente.')
        return
      }

      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `Falha ao validar sessao (HTTP ${resp.status}).`)
      }

      const enabled = Boolean(data.authEnabled)
      const isAuthed = enabled ? Boolean(data.authenticated) : true
      setAuthEnabled(enabled)
      setAuthenticated(isAuthed)
      setAccount(data.account || null)
    } catch (e) {
      if (authSnapshotRef.current.authenticated) {
        setError(
          `Falha temporaria ao validar sessao. Mantendo acesso enquanto o deploy estabiliza. (${e?.message || String(e)})`,
        )
        return
      }

      setAuthEnabled(true)
      setAuthenticated(false)
      setAccount(null)
      setError(e?.message || String(e))
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await refresh()
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => {
      refresh()
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [refresh])

  const api = useMemo(() => {
    return {
      loading,
      authEnabled,
      authenticated,
      account,
      error,
      async login(username, password) {
        const payload = {
          username: String(username || '').trim(),
          password: String(password || ''),
          deviceId: createDeviceId(),
        }

        const resp = await fetch('/api/access', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
        })
        const data = await parseJson(resp)
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || `Falha no login (HTTP ${resp.status}).`)
        }

        setAuthEnabled(Boolean(data.authEnabled))
        setAuthenticated(Boolean(data.authenticated))
        setAccount(data.account || null)
        setError('')
      },
      async logout() {
        try {
          await fetch('/api/access', {
            method: 'DELETE',
            credentials: 'include',
            cache: 'no-store',
          })
        } finally {
          setAuthenticated(false)
          setAccount(null)
        }
      },
      refresh,
    }
  }, [account, authEnabled, authenticated, error, loading, refresh])

  return <AccessContext.Provider value={api}>{children}</AccessContext.Provider>
}
