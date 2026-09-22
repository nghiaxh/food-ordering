import { create } from 'zustand'
import type { AuthUser } from '../types'

const KEY = 'auth'

interface AuthState {
  user: AuthUser | null
  setUser: (u: AuthUser, persist?: boolean) => void
  logout: () => void
}

function loadUser(): AuthUser | null {
  const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  setUser: (user, persist = true) => {
    const storage = persist ? localStorage : sessionStorage
    storage.setItem(KEY, JSON.stringify(user))
    set({ user })
  },
  logout: () => {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
    set({ user: null })
  },
}))