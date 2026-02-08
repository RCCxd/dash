import { useEffect, useMemo, useState } from 'react'
import { UserDataContext } from './userDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'
import { SHARED_ROUTINE_EVENTS } from '../../data/sharedRoutine.js'

const USER_ROUTINE_KEY = 'studentDashboard.userRoutine.v1'

function normalizeEvent(e) {
  const source = e?.source === 'shared' || String(e?.id || '').startsWith('shared-') ? 'shared' : 'user'
  return {
    id: String(e.id || ''),
    day: Number.isFinite(Number(e.day)) ? Number(e.day) : 0,
    start: String(e.start || '08:00'),
    end: String(e.end || '09:00'),
    title: String(e.title || 'Estudo'),
    createdAt: Number(e.createdAt || Date.now()),
    source,
  }
}

function isSharedEvent(event) {
  return event?.source === 'shared' || String(event?.id || '').startsWith('shared-')
}

function withSharedRoutine(events) {
  const normalized = Array.isArray(events) ? events.map(normalizeEvent) : []
  const localOnly = normalized.filter((event) => !isSharedEvent(event))
  return [...SHARED_ROUTINE_EVENTS, ...localOnly]
}

export function UserDataProvider({ children }) {
  const [userRoutine, setUserRoutine] = useState(() => {
    const stored = getStoredJSON(USER_ROUTINE_KEY, [])
    return withSharedRoutine(stored)
  })

  useEffect(() => {
    const localOnly = userRoutine.filter((event) => !isSharedEvent(event))
    setStoredJSON(USER_ROUTINE_KEY, localOnly)
  }, [userRoutine])

  const api = useMemo(() => {
    return {
      userRoutine,
      setUserRoutine,
      addUserRoutineEvents(events) {
        setUserRoutine((prev) => withSharedRoutine([...events.map(normalizeEvent), ...prev]))
      },
      updateUserRoutineEvent(id, patch) {
        const eventId = String(id || '')
        if (!eventId) return
        setUserRoutine((prev) => {
          const target = prev.find((e) => e.id === eventId)
          if (!target || isSharedEvent(target)) return prev

          return withSharedRoutine(
            prev.map((e) =>
              e.id === eventId ? normalizeEvent({ ...e, ...(patch || {}), id: e.id, createdAt: e.createdAt }) : e,
            ),
          )
        })
      },
      deleteUserRoutineEvent(id) {
        const eventId = String(id || '')
        if (!eventId) return
        setUserRoutine((prev) => {
          const target = prev.find((e) => e.id === eventId)
          if (!target || isSharedEvent(target)) return prev
          return withSharedRoutine(prev.filter((e) => e.id !== eventId))
        })
      },
      replaceUserRoutine(events) {
        setUserRoutine(withSharedRoutine(events))
      },
    }
  }, [userRoutine])

  return <UserDataContext.Provider value={api}>{children}</UserDataContext.Provider>
}
