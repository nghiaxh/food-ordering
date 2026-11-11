import http from '@/shared/api/http'

export const adminSaveFood = (id: number | null, data: object) =>
  id ? http.put(`/admin/foods/${id}`, data) : http.post('/admin/foods', data)

export const adminDeleteFood = (id: number) => http.delete(`/admin/foods/${id}`)

export const adminSaveCategory = (
  id: number | null,
  data: { name: string; slug: string; imageUrl: string; description: string },
) =>
  id ? http.put(`/admin/categories/${id}`, data) : http.post('/admin/categories', data)

export const adminDeleteCategory = (id: number) => http.delete(`/admin/categories/${id}`)

export const adminUploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return http.post<{ url: string }>('/admin/uploads/image', form).then((r) => r.data)
}