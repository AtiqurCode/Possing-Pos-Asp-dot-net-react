import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/endpoints'
import type { User } from '../types'

type AuthState = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  ready: boolean
}

const AuthContext = createContext<AuthState | null>(null)

function readStoredUser(): User | null {
  const raw = localStorage.getItem('possing_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function persist(token: string | null, user: User | null) {
  if (token && user) {
    localStorage.setItem('possing_token', token)
    localStorage.setItem('possing_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('possing_token')
    localStorage.removeItem('possing_user')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('possing_token'))
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [ready, setReady] = useState(() => !localStorage.getItem('possing_token'))

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const stored = localStorage.getItem('possing_token')
      if (!stored) {
        if (!cancelled) setReady(true)
        return
      }

      try {
        const me = await authApi.me()
        if (cancelled) return
        persist(stored, me)
        setToken(stored)
        setUser(me)
      } catch {
        if (cancelled) return
        persist(null, null)
        setToken(null)
        setUser(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      ready,
      isAdmin: user?.role === 'Admin',
      login: async (username, password) => {
        const result = await authApi.login(username, password)
        persist(result.token, result.user)
        setToken(result.token)
        setUser(result.user)
        setReady(true)
      },
      logout: () => {
        persist(null, null)
        setToken(null)
        setUser(null)
      },
    }),
    [token, user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
