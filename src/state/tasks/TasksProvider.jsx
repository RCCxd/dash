import { useEffect, useMemo, useState } from 'react'
import { TasksContext } from './tasksContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'
import { newId } from '../../utils/ids.js'
import { useGlobalData } from '../global/globalDataContext.js'

const TASK_STATUS_KEY = 'studentDashboard.taskStatusById.v1'

function normalizeTask(input, source) {
  const now = Date.now()
  return {
    id: input.id ?? newId(),
    subject: input.subject ?? '',
    title: input.title ?? '',
    description: input.description ?? '',
    dueDate: input.dueDate ?? '',
    priority: input.priority ?? 'medium',
    status: input.status ?? 'pending',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    source,
  }
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const ad = a.dueDate || '9999-12-31'
    const bd = b.dueDate || '9999-12-31'
    if (ad < bd) return -1
    if (ad > bd) return 1
    return b.updatedAt - a.updatedAt
  })
}

export function TasksProvider({ children }) {
  const { tasks: globalTasksEnvelope } = useGlobalData()
  const [statusById, setStatusById] = useState(() => {
    const stored = getStoredJSON(TASK_STATUS_KEY, {})
    if (!stored || typeof stored !== 'object') return {}
    return stored
  })

  useEffect(() => {
    setStoredJSON(TASK_STATUS_KEY, statusById)
  }, [statusById])

  const api = useMemo(() => {
    const globalRaw = globalTasksEnvelope?.tasks
    const globalTasks = Array.isArray(globalRaw)
      ? globalRaw.map((t) => {
          const base = normalizeTask({ ...t, status: 'pending' }, 'global')
          const local = statusById?.[base.id]
          const status = local === 'done' ? 'done' : 'pending'
          return { ...base, status }
        })
      : []

    return {
      tasks: sortTasks(globalTasks),
      setTaskStatus(id, status) {
        setStatusById((prev) => ({ ...(prev || {}), [id]: status }))
      },
    }
  }, [globalTasksEnvelope, statusById])

  return <TasksContext.Provider value={api}>{children}</TasksContext.Provider>
}
