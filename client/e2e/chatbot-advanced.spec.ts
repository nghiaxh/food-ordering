import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, listFoods } from './support/extended-api'

/**
 * Chatbot thật: server gọi AI hai lượt rồi trả thẻ món dựng từ DB. Test chỉ khẳng định
 * trên `response.foods` (dữ liệu server) chứ không đọc câu chữ do AI viết.
 *
 * Cần `AI_API_KEY` thật ở server. Khi `/chatbot/status` báo `available = false`, cả file
 * được skip thay vì fail: CI dùng khóa giả trong `.env.example` nên nhánh này bỏ qua.
 */
interface ChatFoodCard {
  id: number
  name: string
  price: string
  categoryName: string | null
  portions?: number
  totalPrice?: string
}

interface ChatResponse {
  reply: string
  foods: ChatFoodCard[]
}

interface ChatPayload {
  message: string
  history?: string[]
  lastFoodIds?: number[]
}

const SKIP_REASON =
  'Chatbot chưa cấu hình khóa AI (AI_API_KEY rỗng hoặc bị từ chối); đặt khóa thật rồi chạy lại.'

// Mỗi lượt chat gọi AI hai lần, mỗi lần timeout 15s ở server.
test.describe.configure({ mode: 'serial', timeout: 120_000 })

// Tắt hiệu ứng chạy chữ để tin bot hiện đủ ngay, không phải chờ vài giây.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

test.beforeEach(async ({ request }) => {
  const res = await request.get(`${API_URL}/chatbot/status`)
  const status = res.ok() ? ((await res.json()) as { available: boolean }) : { available: false }
  test.skip(!status.available, SKIP_REASON)
})

async function openChat(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở trợ lý' }).click()
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
  await expect(page.getByLabel('Nhập câu hỏi cho chatbot')).toBeEnabled()
}

/** Gửi một câu và trả về body server cùng payload client đã gửi (để kiểm tra ngữ cảnh). */
async function ask(page: Page, question: string) {
  const botMessages = page.getByTestId('chatbot-bot-message')
  const before = await botMessages.count()

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/chatbot/chat') && res.request().method() === 'POST',
  )
  await page.getByLabel('Nhập câu hỏi cho chatbot').fill(question)
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()

  const response = await responsePromise
  expect(response.status(), 'Chatbot phải trả 200 khi đã cấu hình khóa').toBe(200)
  const payload = response.request().postDataJSON() as ChatPayload
  const body = (await response.json()) as ChatResponse

  // Đợi tin bot mới render xong (kèm thẻ) trước khi hỏi tiếp.
  await expect(botMessages).toHaveCount(before + 1)
  await expect(page.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled()
  return { body, payload }
}

async function foodsById(request: APIRequestContext) {
  const foods = await listFoods(request)
  return new Map(foods.map((food) => [food.id, food]))
}

test('lọc món không cay và không chứa hải sản', async ({ page, request }) => {
  await openChat(page)
  const { body } = await ask(page, 'Tôi muốn ăn món Việt, không cay và không có hải sản')
  expect(body.foods.length).toBeGreaterThan(0)

  const foods = await foodsById(request)
  for (const card of body.foods) {
    const food = foods.get(card.id)
    expect(food, `Thẻ "${card.name}" phải lấy từ DB`).toBeTruthy()
    expect(food!.spicyLevel, `${card.name} phải không cay`).toBe(0)
    expect(food!.allergens.toLowerCase(), `${card.name} không được chứa hải sản`).not.toContain(
      'hải sản',
    )
  }
})

test('gợi ý cho 4 người nằm trong tổng ngân sách 200.000đ', async ({ page }) => {
  await openChat(page)
  const { body } = await ask(page, 'Gợi ý món ăn cho 4 người trong tầm giá 200.000đ')

  expect(body.foods.length).toBeGreaterThan(0)
  expect(body.foods.length).toBeLessThanOrEqual(5)

  let total = 0
  for (const card of body.foods) {
    const portions = card.portions ?? 1
    expect(portions, `${card.name} phải có ít nhất 1 phần`).toBeGreaterThanOrEqual(1)
    total += Number(card.totalPrice ?? card.price)
  }
  expect(total, 'Tổng tiền cả bộ phải nằm trong ngân sách').toBeLessThanOrEqual(200_000)
  // Số người phải được áp vào khẩu phần, không chỉ dùng để trang trí câu trả lời.
  expect(body.foods.some((card) => (card.portions ?? 1) > 1)).toBe(true)
})

test('ghép một món chính và một món uống trong 150.000đ', async ({ page }) => {
  await openChat(page)
  const { body } = await ask(page, '1 món chính và 1 món uống khoảng 150k')

  expect(body.foods).toHaveLength(2)
  const drinks = body.foods.filter((card) => card.categoryName === 'Đồ uống')
  expect(drinks, 'Phải có đúng một món thuộc nhóm Đồ uống').toHaveLength(1)

  const total = body.foods.reduce((sum, card) => sum + Number(card.totalPrice ?? card.price), 0)
  expect(total).toBeLessThanOrEqual(150_000)
})

test('gợi ý món chay chỉ trả món có nhãn chay', async ({ page, request }) => {
  await openChat(page)
  const { body } = await ask(page, 'Gợi ý món chay')

  expect(body.foods.length).toBeGreaterThan(0)
  const foods = await foodsById(request)
  for (const card of body.foods) {
    const food = foods.get(card.id)
    expect(food, `Thẻ "${card.name}" phải lấy từ DB`).toBeTruthy()
    expect(food!.dietaryTags.toLowerCase(), `${card.name} phải có nhãn chay`).toContain('chay')
  }
})

test('câu hỏi ngoài lề không trả thẻ món', async ({ page }) => {
  await openChat(page)
  const { body } = await ask(page, 'Thời tiết hôm nay thế nào?')

  expect(body.foods).toHaveLength(0)
  await expect(page.getByTestId('chatbot-food-card')).toHaveCount(0)
})

test('câu hỏi tiếp dùng đúng các món vừa gợi ý', async ({ page }) => {
  await openChat(page)
  const first = await ask(page, 'Gợi ý món chay')
  expect(first.body.foods.length).toBeGreaterThan(0)
  const firstIds = first.body.foods.map((card) => card.id)

  const second = await ask(page, 'Món đó cay không?')

  expect(second.payload.lastFoodIds, 'Client phải gửi lại ID các món vừa gợi ý').toEqual(firstIds)
  expect(second.body.foods.length).toBeGreaterThan(0)
  for (const card of second.body.foods) {
    expect(firstIds, `${card.name} phải nằm trong lượt gợi ý trước`).toContain(card.id)
  }
})

test('chủ đề mới bỏ qua ngữ cảnh của lượt trước', async ({ page, request }) => {
  await openChat(page)
  const first = await ask(page, 'Gợi ý món bò')
  const firstIds = first.body.foods.map((card) => card.id)

  const second = await ask(page, 'Có món chay nào ngon không?')

  // Client vẫn gửi ngữ cảnh cũ; server phải bỏ qua vì câu này mở chủ đề mới.
  expect(second.payload.lastFoodIds).toEqual(firstIds)
  expect(second.body.foods.length).toBeGreaterThan(0)

  const foods = await foodsById(request)
  for (const card of second.body.foods) {
    const food = foods.get(card.id)
    expect(food, `Thẻ "${card.name}" phải lấy từ DB`).toBeTruthy()
    expect(food!.dietaryTags.toLowerCase(), `${card.name} phải có nhãn chay`).toContain('chay')
  }
  expect(
    second.body.foods.some((card) => !firstIds.includes(card.id)),
    'Phải có món ngoài ngữ cảnh cũ thì mới chứng minh server bỏ ngữ cảnh',
  ).toBe(true)
})
