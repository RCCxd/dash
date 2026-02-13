import { createContext, useContext } from 'react'

export const AccessContext = createContext(null)

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used within <AccessProvider />')
  return ctx
}

