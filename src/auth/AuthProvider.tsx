import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getMyAccountType } from '../services/ngos'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accountType, setAccountType] = useState<'volunteer' | 'ngo' | 'admin' | null>(null)
  const [accountTypeError, setAccountTypeError] = useState(false)
  const [accountTypeAttempt, setAccountTypeAttempt] = useState(0)
  const [accountTypeUserId, setAccountTypeUserId] = useState<string | null>(null)
  const userId = session?.user.id ?? null

  useEffect(() => {
    let isMounted = true

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (isMounted) setSession(data.session)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      return
    }

    let isCurrent = true
    void getMyAccountType()
      .then((nextAccountType) => {
        if (!isCurrent) return
        setAccountType(nextAccountType)
        setAccountTypeUserId(userId)
      })
      .catch(() => {
        if (!isCurrent) return
        setAccountType(null)
        setAccountTypeError(true)
        setAccountTypeUserId(userId)
      })

    return () => {
      isCurrent = false
    }
  }, [accountTypeAttempt, userId])

  const hasCurrentAccountType = accountTypeUserId === userId
  const resolvedAccountType = hasCurrentAccountType ? accountType : null
  const resolvedAccountTypeError = hasCurrentAccountType ? accountTypeError : false
  const resolvedAccountTypeLoading = Boolean(userId && !hasCurrentAccountType)

  const value = useMemo(
    () => ({
      accountType: resolvedAccountType,
      accountTypeError: resolvedAccountTypeError,
      isAccountTypeLoading: resolvedAccountTypeLoading,
      isLoading,
      retryAccountType: () => {
        setAccountTypeUserId(null)
        setAccountTypeAttempt((attempt) => attempt + 1)
      },
      session,
      user: session?.user ?? null,
    }),
    [isLoading, resolvedAccountType, resolvedAccountTypeError, resolvedAccountTypeLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
