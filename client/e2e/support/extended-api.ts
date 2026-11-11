import type { APIRequestContext, Page } from '@playwright/test'

// Neu du an chua cai @types/node, khai bao toi thieu nay du cho `process.env.API_URL`.
declare const process: { env: Record<string, string | undefined> }

/**
 * Du lieu E2E dung API that de dung/ don trang thai thay vi dung CSDL truc tiep.
 * `VITE_API_URL` cua client tro thang cong 8080 nen test cung goi cung dia chi do.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:8080/api'

export interface DemoSession {
  token: string
  id: number
  email: string
  fullName: string
  role: 'CUSTOMER' | 'ADMIN'
}

export interface ApiFood {
  id: number
  name: string
  price: number
  spicyLevel: number
  dietaryTags: string
  allergens: string
  ingredients: string
  available: boolean
  category: { id: number; name: string } | null
}

export interface ApiReview {
  id: number
  userName: string
  rating: number
  comment: string | null
  mine: boolean
}

export interface ApiNotification {
  id: number
  content: string
  read: boolean
  orderId: number | null
}

/** Mat khau cua tai khoan demo luon la phan truoc dau `@`. */
export function demoPassword(email: string): string {
  return email.split('@')[0]
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

export async function apiLogin(request: APIRequestContext, email: string): Promise<DemoSession> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password: demoPassword(email) },
  })
  if (!res.ok()) {
    throw new Error(`API login failed for ${email}: ${res.status()} ${await res.text()}`)
  }
  return (await res.json()) as DemoSession
}

/** Dang nhap qua giao dien; dung khi da ve trang chu de form va store gio da san sang. */
export async function loginInBrowser(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(demoPassword(email))
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  // Absolute pathname check vi `waitForURL('/')` so khop ca URL goc co origin.
  await page.waitForURL((url) => url.pathname === '/')
}

export async function clearCart(request: APIRequestContext, token: string): Promise<void> {
  await request.delete(`${API_URL}/cart`, { headers: authHeaders(token) })
}

export async function listFoods(request: APIRequestContext): Promise<ApiFood[]> {
  const res = await request.get(`${API_URL}/foods`)
  if (!res.ok()) throw new Error(`Could not load the menu: ${res.status()}`)
  return (await res.json()) as ApiFood[]
}

export async function foodIdByName(request: APIRequestContext, name: string): Promise<number> {
  const food = (await listFoods(request)).find((f) => f.name === name)
  if (!food) throw new Error(`Food "${name}" not found in the seed data`)
  return food.id
}

export async function firstAvailableFoodId(request: APIRequestContext): Promise<number> {
  const food = (await listFoods(request)).find((f) => f.available)
  if (!food) throw new Error('No available dish in the menu')
  return food.id
}

export async function getReviews(
  request: APIRequestContext,
  token: string,
  foodId: number,
): Promise<ApiReview[]> {
  const res = await request.get(`${API_URL}/reviews/food/${foodId}`, {
    headers: authHeaders(token),
  })
  if (!res.ok()) throw new Error(`Could not load reviews: ${res.status()}`)
  return (await res.json()) as ApiReview[]
}

export async function findMyReview(
  request: APIRequestContext,
  token: string,
  foodId: number,
): Promise<ApiReview | undefined> {
  return (await getReviews(request, token, foodId)).find((r) => r.mine)
}

export async function deleteMyReviews(
  request: APIRequestContext,
  token: string,
  foodId: number,
): Promise<void> {
  for (const review of (await getReviews(request, token, foodId)).filter((r) => r.mine)) {
    await request.delete(`${API_URL}/reviews/${review.id}`, { headers: authHeaders(token) })
  }
}

export async function createReview(
  request: APIRequestContext,
  token: string,
  foodId: number,
  rating: number,
  comment?: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/reviews`, {
    headers: authHeaders(token),
    data: { foodId, rating, comment },
  })
  if (!res.ok()) throw new Error(`Could not create the review: ${res.status()} ${await res.text()}`)
}

export interface ApiOrder {
  id: number
  total: number
}

/** Moi don moi sinh mot thong bao "da duoc tao" nen test thong bao khong phu thuoc seed. */
export async function createOrder(
  request: APIRequestContext,
  token: string,
  foodId: number,
  receiver: { fullName: string; phone: string; address: string },
): Promise<ApiOrder> {
  const res = await request.post(`${API_URL}/orders`, {
    headers: authHeaders(token),
    data: {
      items: [{ foodId, quantity: 1 }],
      receiverName: receiver.fullName,
      phone: receiver.phone,
      address: receiver.address,
      paymentMethod: 'COD',
    },
  })
  if (!res.ok()) throw new Error(`Could not create the order: ${res.status()} ${await res.text()}`)
  return (await res.json()) as ApiOrder
}

export async function getNotifications(
  request: APIRequestContext,
  token: string,
): Promise<ApiNotification[]> {
  const res = await request.get(`${API_URL}/notifications`, { headers: authHeaders(token) })
  if (!res.ok()) throw new Error(`Could not load notifications: ${res.status()}`)
  return (await res.json()) as ApiNotification[]
}

export async function markNotificationRead(
  request: APIRequestContext,
  token: string,
  id: number,
): Promise<void> {
  await request.post(`${API_URL}/notifications/${id}/read`, { headers: authHeaders(token) })
}

/** Don thong bao do chinh test tao de lan chay sau khong phinh danh sach. */
export async function deleteNotificationsForOrder(
  request: APIRequestContext,
  token: string,
  orderId: number,
): Promise<void> {
  for (const notification of (await getNotifications(request, token)).filter(
    (n) => n.orderId === orderId,
  )) {
    await request.delete(`${API_URL}/notifications/${notification.id}`, {
      headers: authHeaders(token),
    })
  }
}
