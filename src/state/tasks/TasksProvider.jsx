import { useEffect, useMemo, useState } from 'react'
import { TasksContext } from './tasksContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'
import { newId } from '../../utils/ids.js'
import { useGlobalData } from '../global/globalDataContext.js'

const TASK_STATUS_KEY = 'studentDashboard.taskStatusById.v1'
const USER_TASKS_KEY = 'studentDashboard.userTasks.v1'

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

function priorityRank(p) {
  if (p === 'high') return 3
  if (p === 'medium') return 2
  return 1
}

function maxPriority(a, b) {
  return priorityRank(a) >= priorityRank(b) ? a : b
}

function dueBoostPriority(priority, dueDate) {
  const base = priority === 'high' || priority === 'low' ? priority : 'medium'
  if (!dueDate) return base

  const [y, m, d] = String(dueDate).split('-').map((x) => Number(x))
  if (!y || !m || !d) return base

  const due = new Date(y, m - 1, d)
  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const du = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const deltaDays = Math.round((du - t) / (24 * 60 * 60 * 1000))

  let duePriority = 'low'
  if (deltaDays <= 0) duePriority = 'high'
  else if (deltaDays <= 3) duePriority = 'high'
  else if (deltaDays <= 7) duePriority = 'medium'

  return maxPriority(base, duePriority)
}

export function TasksProvider({ children }) {
  const { tasks: globalTasksEnvelope } = useGlobalData()
  const [statusById, setStatusById] = useState(() => {
    const stored = getStoredJSON(TASK_STATUS_KEY, {})
    if (!stored || typeof stored !== 'object') return {}
    return stored
  })

  const [userTasksEnvelope, setUserTasksEnvelope] = useState(() => {
    const stored = getStoredJSON(USER_TASKS_KEY, { tasks: [] })
    if (!stored || typeof stored !== 'object') return { tasks: [] }
    const tasks = Array.isArray(stored.tasks) ? stored.tasks : []
    return { ...stored, tasks }
  })

  useEffect(() => {
    setStoredJSON(TASK_STATUS_KEY, statusById)
  }, [statusById])

  useEffect(() => {
    setStoredJSON(USER_TASKS_KEY, userTasksEnvelope)
  }, [userTasksEnvelope])

  const api = useMemo(() => {
    const globalRaw = globalTasksEnvelope?.tasks
    const globalTasks = Array.isArray(globalRaw)
      ? globalRaw.map((t) => {
           const base = normalizeTask({ ...t, status: 'pending' }, 'global')
           const local = statusById?.[base.id]
           const status = local === 'done' ? 'done' : 'pending'
           return { ...base, status, effectivePriority: dueBoostPriority(base.priority, base.dueDate) }
         })
       : []

    const userRaw = userTasksEnvelope?.tasks
    const userTasks = Array.isArray(userRaw)
      ? userRaw.map((t) => {
           const base = normalizeTask({ ...t, status: 'pending' }, 'user')
           const local = statusById?.[base.id]
           const status = local === 'done' ? 'done' : 'pending'
           return { ...base, status, effectivePriority: dueBoostPriority(base.priority, base.dueDate) }
         })
       : []

    const all = [...globalTasks, ...userTasks]

    return {
      tasks: sortTasks(all),
      globalTasks: sortTasks(globalTasks),
      userTasks: sortTasks(userTasks),
      setTaskStatus(id, status) {
        setStatusById((prev) => ({ ...(prev || {}), [id]: status }))
      },
      addUserTask(input) {
        const now = Date.now()
        const next = normalizeTask(
          {
            ...input,
            id: newId(),
            createdAt: now,
            updatedAt: now,
            status: 'pending',
          },
          'user',
        )
        setUserTasksEnvelope((prev) => ({ ...(prev || {}), tasks: [next, ...(prev?.tasks || [])] }))
        return next
      },
      updateUserTask(id, patch) {
        const taskId = String(id || '')
        if (!taskId) return
        const now = Date.now()
        setUserTasksEnvelope((prev) => {
          const list = Array.isArray(prev?.tasks) ? prev.tasks : []
          const nextList = list.map((t) =>
            t?.id === taskId ? { ...t, ...(patch || {}), updatedAt: now } : t,
          )
          return { ...(prev || {}), tasks: nextList }
        })
      },
      deleteUserTask(id) {
        const taskId = String(id || '')
        if (!taskId) return
        setUserTasksEnvelope((prev) => {
          const list = Array.isArray(prev?.tasks) ? prev.tasks : []
          return { ...(prev || {}), tasks: list.filter((t) => t?.id !== taskId) }
        })
        setStatusById((prev) => {
          if (!prev || typeof prev !== 'object') return prev
          if (!(taskId in prev)) return prev
          const next = { ...prev }
          delete next[taskId]
          return next
        })
      },
    }
  }, [globalTasksEnvelope, statusById, userTasksEnvelope])

  return <TasksContext.Provider value={api}>{children}</TasksContext.Provider>
}
