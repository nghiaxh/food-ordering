import { create } from 'zustand'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  setUser: (u: AuthUser) => void
  logout: () => void
}

const saved = localStorage.getItem('auth')

export const useAuthStore = create<AuthState>((set) => ({
  user: saved ? (JSON.parse(saved) as AuthUser) : null,
  setUser: (user) => {
    localStorage.setItem('auth', JSON.stringify(user))
    set({ user })
  },
  logout: () => {
    localStorage.removeItem('auth')
    set({ user: null })
  },
}))