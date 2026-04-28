/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { authApi, getToken, setToken } from "@/lib/api"
import type { Me, UserRole } from "@/types"

type AuthState = {
  user: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<Me>
  register: (
    email: string,
    password: string,
    role: "FARMER" | "AGRONOMIST"
  ) => Promise<Me>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login(email, password)
    setToken(token)
    setUser(u)
    return u
  }, [])

  const register = useCallback(
    async (email: string, password: string, role: "FARMER" | "AGRONOMIST") => {
      const { token, user: u } = await authApi.register({ email, password, role })
      setToken(token)
      setUser(u)
      return u
    },
    []
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, login, register, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function useRequireRole(roles: UserRole | UserRole[]) {
  const { user } = useAuth()
  const list = Array.isArray(roles) ? roles : [roles]
  if (!user) return { ok: false as const, user: null }
  if (!list.includes(user.role)) return { ok: false as const, user }
  return { ok: true as const, user }
}
