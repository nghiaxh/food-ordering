import { expect, type Page, type APIRequestContext } from '@playwright/test'
import { API_URL, apiLogin, listFoods } from './extended-api'

const DEMO_EMAIL = 'tuanpham@demo.com'

export interface ChatFoodCard {
  id: number
  name: string
  imageUrl: string | null
  categoryName: string | null
}

export interface ChatResponse {
  reply: string
  foods: ChatFoodCard[]
}

export interface ChatPayload {
  message: string
  history?: string[]
  lastFoodIds?: number[]
}

export const SKIP_REASON =
  'Chatbot has no AI key configured (AI_API_KEY empty or rejected); set a real key and rerun.'

export async function chatbotAvailable(request: APIRequestContext) {
  const res = await request.get(`${API_URL}/chatbot/status`)
  if (!res.ok()) return false
  const status = (await res.json()) as { available?: boolean }
  return status.available === true
}

export async function openChatPanel(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở trợ lý' }).click()
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
}

export async function openChat(page: Page) {
  await openChatPanel(page)
  await expect(page.getByLabel('Nhập câu hỏi cho chatbot')).toBeEnabled({ timeout: 10_000 }).catch(() => {})
}

export async function ask(page: Page, question: string) {
  const botMessages = page.getByTestId('chatbot-bot-message')
  const before = await botMessages.count()

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/chatbot/chat') && res.request().method() === 'POST',
  )
  await page.getByLabel('Nhập câu hỏi cho chatbot').fill(question)
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()

  const response = await responsePromise
  expect(response.status(), 'Chatbot should return 200 once the key is configured').toBe(200)
  const payload = response.request().postDataJSON() as ChatPayload
  const body = (await response.json()) as ChatResponse

  await expect(botMessages).toHaveCount(before + 1, { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Huỷ' })).toHaveCount(0, { timeout: 20_000 })
  return { body, payload }
}

export async function foodsById(request: APIRequestContext) {
  const foods = await listFoods(request)
  return new Map(foods.map((food) => [food.id, food]))
}

export async function signIn(page: Page) {
  const session = await apiLogin(page.request, DEMO_EMAIL)
  await page.addInitScript((user) => localStorage.setItem('auth', JSON.stringify(user)), session)
  await page.goto('/')
}