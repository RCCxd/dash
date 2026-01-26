import { createContext, useContext } from 'react'

export const GlobalDataContext = createContext(null)

export function useGlobalData() {
  const ctx = useContext(GlobalDataContext)
  if (!ctx) throw new Error('useGlobalData must be used within <GlobalDataProvider />')
  return ctx
}

