import { useEffect, useMemo, useState } from 'react'
import { UserDataContext } from './userDataContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'

const USER_ROUTINE_KEY = 'studentDashboard.userRoutine.v1'

function normalizeEvent(e) {
  return {
    id: String(e.id || ''),
    day: Number.isFinite(Number(e.day)) ? Number(e.day) : 0,
    start: String(e.start || '08:00'),
    end: String(e.end || '09:00'),
    title: String(e.title || 'Estudo'),
    createdAt: Number(e.createdAt || Date.now()),
  }
}

export function UserDataProvider({ children }) {
  const [userRoutine, setUserRoutine] = useState(() => {
    const stored = getStoredJSON(USER_ROUTINE_KEY, [])
    return Array.isArray(stored) ? stored.map(normalizeEvent) : []
  })

  useEffect(() => {
    setStoredJSON(USER_ROUTINE_KEY, userRoutine)
  }, [userRoutine])

  const api = useMemo(() => {
    return {
      userRoutine,
      setUserRoutine,
      addUserRoutineEvents(events) {
        setUserRoutine((prev) => [...events.map(normalizeEvent), ...prev])
      },
      updateUserRoutineEvent(id, patch) {
        const eventId = String(id || '')
        if (!eventId) return
        setUserRoutine((prev) =>
          prev.map((e) =>
            e.id === eventId ? normalizeEvent({ ...e, ...(patch || {}), id: e.id, createdAt: e.createdAt }) : e,
          ),
        )
      },
      deleteUserRoutineEvent(id) {
        setUserRoutine((prev) => prev.filter((e) => e.id !== id))
      },
      replaceUserRoutine(events) {
        setUserRoutine(events.map(normalizeEvent))
      },
    }
  }, [userRoutine])

  return <UserDataContext.Provider value={api}>{children}</UserDataContext.Provider>
}
