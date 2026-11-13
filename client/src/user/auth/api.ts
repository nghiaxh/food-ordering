import http from '@/shared/api/http'
import type { AuthUser, User } from '@/shared/types'

export const login = (email: string, password: string) =>
  http.post<AuthUser>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: { email: string; password: string; fullName: string; phone?: string; address?: string }) =>
  http.post<AuthUser>('/auth/register', data).then((r) => r.data)

export const getMe = (signal?: AbortSignal) => http.get<User>('/auth/me', { signal }).then((r) => r.data)

export const updateMe = (data: { fullName: string; phone: string; address: string }) =>
  http.put<User>('/auth/me', data).then((r) => r.data)

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  http.put('/auth/password', data)
