import { getStoredJSON, setStoredJSON } from './storage.js'
import { newId } from './ids.js'

const KEY = 'studentDashboard.userId.v1'

export function getUserId() {
  const stored = getStoredJSON(KEY, null)
  if (typeof stored === 'string' && stored.length > 5) return stored
  const id = newId()
  setStoredJSON(KEY, id)
  return id
}

