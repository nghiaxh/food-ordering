import { defineStore } from 'pinia'
import type { AuthUser } from '@/shared/types'

const KEY = 'auth'

// Shape khop AuthUser trong shared/types; storage bai hoac bieu tu ban lam UI tuong
// da dang nhap va request rong token, nen khong hop le thi coi nhu chua dang nhap.
const isAuthUser = (value: unknown): value is AuthUser => {
  if (typeof value !== 'object' || value === null) return false
  const u = value as Record<string, unknown>
  return (
    typeof u.token === 'string' &&
    u.token.length > 0 &&
    typeof u.id === 'number' &&
    typeof u.email === 'string' &&
    u.email.length > 0 &&
    typeof u.fullName === 'string' &&
    (u.role === 'CUSTOMER' || u.role === 'ADMIN')
  )
}

const loadUser = (): AuthUser | null => {
  const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isAuthUser(parsed)) return parsed
  } catch {
    // JSON hong: roi xuong xoa storage o duoi.
  }
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
  return null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: loadUser() as AuthUser | null,
  }),
  getters: {
    isAdmin: (state) => state.user?.role === 'ADMIN',
  },
  actions: {
    setUser(user: AuthUser, persist = true) {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
      ;(persist ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(user))
      this.user = user
    },
    logout() {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
      this.user = null
    },
  },
})
