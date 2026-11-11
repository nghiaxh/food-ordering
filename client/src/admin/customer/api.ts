import http from '@/shared/api/http'
import type { User } from '@/shared/types'

export interface UserPayload {
  email: string
  fullName: string
  phone?: string
  address?: string
  password?: string
}

export const adminGetUsers = () => http.get<User[]>('/admin/users').then((r) => r.data)

export const adminSaveUser = (id: number | null, data: UserPayload) =>
  id ? http.put(`/admin/users/${id}`, data) : http.post('/admin/users', data)

export const adminDeleteUser = (id: number) => http.delete(`/admin/users/${id}`)

export const adminSetUserActive = (id: number, active: boolean) =>
  http.patch(`/admin/users/${id}/active`, null, { params: { active } })