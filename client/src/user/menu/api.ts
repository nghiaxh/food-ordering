import http from '@/shared/api/http'
import type { Category, Food } from '@/shared/types'

export const getCategories = (signal?: AbortSignal) =>
  http.get<Category[]>('/categories', { signal }).then((r) => r.data)

export const getFoods = (
  params?: { keyword?: string; categoryId?: number; minPrice?: number; maxPrice?: number },
  signal?: AbortSignal,
) => http.get<Food[]>('/foods', { params, signal }).then((r) => r.data)

export const getFood = (id: number, signal?: AbortSignal) =>
  http.get<Food>(`/foods/${id}`, { signal }).then((r) => r.data)
