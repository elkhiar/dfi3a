import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthContextValue = {
  accountType: 'volunteer' | 'ngo' | 'admin' | null
  accountTypeError: boolean
  isAccountTypeLoading: boolean
  isLoading: boolean
  retryAccountType: () => void
  session: Session | null
  user: User | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
