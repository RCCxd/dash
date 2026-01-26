import { createContext, useContext } from 'react'

export const UserDataContext = createContext(null)

export function useUserData() {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within <UserDataProvider />')
  return ctx
}

