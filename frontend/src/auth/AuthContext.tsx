import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/endpoints'
import type { User } from '../types'

type AuthState = {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('possing_token'))
  const [user, setUser] = useState<User | null>(() => readStoredUser())

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isAdmin: user?.role === 'Admin',
      login: async (username, password) => {
        const result = await authApi.login(username, password)
        localStorage.setItem('possing_token', result.token)
        localStorage.setItem('possing_user', JSON.stringify(result.user))
        setToken(result.token)
        setUser(result.user)
      },
      logout: () => {
        localStorage.removeItem('possing_token')
        localStorage.removeItem('possing_user')
        setToken(null)
        setUser(null)
      },
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
