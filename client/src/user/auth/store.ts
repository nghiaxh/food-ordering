import { defineStore } from 'pinia'
import type { AuthUser } from '@/shared/types'

const KEY = 'auth'

const loadUser = (): AuthUser | null => {
  const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
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
