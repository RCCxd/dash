import { createContext, useContext } from 'react'

export const TasksContext = createContext(null)

export function useTasks() {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasks must be used within <TasksProvider />')
  return ctx
}

