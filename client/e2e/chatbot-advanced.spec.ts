import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL } from './support/extended-api'
import {
  SKIP_REASON,
  chatbotAvailable,
  openChat,
  openChatPanel,
  ask,
  foodsById,
} from './support/chatbot'

// Moi luot chat goi AI hai lan, moi lan timeout 15s o server.
test.describe.configure({ mode: 'serial', timeout: 120_000 })

// Tat hieu ung chay chu de tin bot hien du ngay, khong phai cho vai giay.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

test('Ask for non-spicy vegetarian dishes', async ({ page, request }) => {
  const available = await chatbotAvailable(request)
  await openChatPanel(page)

  if (!available) {
    await expect(page.getByTestId('chatbot-panel')).toBeVisible()
    await expect(page.getByText('Trợ lý AI chưa được cấu hình')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Nhập câu hỏi cho chatbot')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled()
    test.info().annotations.push({ type: 'note', description: SKIP_REASON })
    return
  }

  const botMessages = page.getByTestId('chatbot-bot-message')
  const before = await botMessages.count()

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/chatbot/chat') && res.request().method() === 'POST',
  )
  await expect(page.getByLabel('Nhập câu hỏi cho chatbot')).toBeEnabled()
  await page.getByLabel('Nhập câu hỏi cho chatbot').fill('Tư vấn món chay không cay')
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()

  const response = await responsePromise
  expect(response.status(), 'Chatbot should return 200 once the key is configured').toBe(200)

  await expect(botMessages).toHaveCount(before + 1, { timeout: 20_000 })
  await expect(page.getByTestId('chatbot-food-card').first()).toBeVisible({ timeout: 20_000 })
})

test.describe('Advanced scenarios', () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get(`${API_URL}/chatbot/status`)
    const status = res.ok() ? ((await res.json()) as { available: boolean }) : { available: false }
    test.skip(!status.available, SKIP_REASON)
  })

  test('Filters out spicy dishes and seafood', async ({ page, request }) => {
    await openChat(page)
    const { body } = await ask(page, 'Tôi muốn ăn món Việt, không cay và không có hải sản')
    expect(body.foods.length).toBeGreaterThan(0)
    await expect(page.getByTestId('chatbot-food-card').first()).toBeVisible({ timeout: 20_000 })

    const foods = await foodsById(request)
    for (const card of body.foods) {
      const food = foods.get(card.id)
      expect(food, `Card "${card.name}" must come from the database`).toBeTruthy()
      expect(food!.spicyLevel, `${card.name} must not be spicy`).toBe(0)
      expect(food!.allergens.toLowerCase(), `${card.name} must not contain seafood`).not.toContain(
        'hải sản',
      )
    }
  })

  test('Suggests dishes for 4 people within a 200.000đ total budget', async ({ page }) => {
    await openChat(page)
    const { body } = await ask(page, 'Gợi ý món ăn cho 4 người trong tầm giá 200.000đ')

    expect(body.foods.length).toBeGreaterThan(0)
    expect(body.foods.length).toBeLessThanOrEqual(5)

    let total = 0
    for (const card of body.foods) {
      const portions = card.portions ?? 1
      expect(portions, `${card.name} must have at least 1 portion`).toBeGreaterThanOrEqual(1)
      total += Number(card.totalPrice ?? card.price)
    }
    expect(total, 'Total price of all cards must stay within the budget').toBeLessThanOrEqual(200_000)
    expect(body.foods.some((card) => (card.portions ?? 1) > 1)).toBe(true)
  })

  test('Combines a main dish and a drink within 150.000đ', async ({ page }) => {
    await openChat(page)
    const { body } = await ask(page, '1 món chính và 1 món uống khoảng 150k')

    expect(body.foods).toHaveLength(2)
    const drinks = body.foods.filter((card) => card.categoryName === 'Đồ uống')
    expect(drinks, 'Expected exactly one drink in the food cards').toHaveLength(1)

    const total = body.foods.reduce((sum, card) => sum + Number(card.totalPrice ?? card.price), 0)
    expect(total).toBeLessThanOrEqual(150_000)
  })

  test('Vegetarian suggestions stay on vegetarian dishes', async ({ page, request }) => {
    await openChat(page)
    const { body } = await ask(page, 'Gợi ý món chay')

    expect(body.foods.length).toBeGreaterThan(0)
    const foods = await foodsById(request)
    for (const card of body.foods) {
      const food = foods.get(card.id)
      expect(food, `Card "${card.name}" must come from the database`).toBeTruthy()
      expect(food!.dietaryTags.toLowerCase(), `${card.name} must carry the vegetarian tag`).toContain('chay')
    }
  })

  test('Out-of-scope question returns no food cards', async ({ page }) => {
    await openChat(page)
    const { body } = await ask(page, 'Thời tiết hôm nay thế nào?')

    expect(body.foods).toHaveLength(0)
    await expect(page.getByTestId('chatbot-food-card')).toHaveCount(0)
  })

  test('Follow-up question reuses the previously suggested dishes', async ({ page }) => {
    await openChat(page)
    const first = await ask(page, 'Gợi ý món chay')
    expect(first.body.foods.length).toBeGreaterThan(0)
    const firstIds = first.body.foods.map((card) => card.id)

    const second = await ask(page, 'Món đó cay không?')

    expect(second.payload.lastFoodIds, 'Client must resend the ids of the previously suggested dishes').toEqual(firstIds)
    expect(second.body.foods.length).toBeGreaterThan(0)
    for (const card of second.body.foods) {
      expect(firstIds, `${card.name} must belong to the previous suggestion round`).toContain(card.id)
    }
  })

  test('New topic ignores the previous turn context', async ({ page, request }) => {
    await openChat(page)
    const first = await ask(page, 'Gợi ý món bò')
    const firstIds = first.body.foods.map((card) => card.id)

    const second = await ask(page, 'Có món chay nào ngon không?')

    expect(second.payload.lastFoodIds).toEqual(firstIds)
    expect(second.body.foods.length).toBeGreaterThan(0)

    const foods = await foodsById(request)
    for (const card of second.body.foods) {
      const food = foods.get(card.id)
      expect(food, `Card "${card.name}" must come from the database`).toBeTruthy()
      expect(food!.dietaryTags.toLowerCase(), `${card.name} must carry the vegetarian tag`).toContain('chay')
    }
    expect(
      second.body.foods.some((card) => !firstIds.includes(card.id)),
      'A dish outside the previous context proves the server dropped the context',
    ).toBe(true)
  })
})