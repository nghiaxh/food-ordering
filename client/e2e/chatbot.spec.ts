import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, apiLogin } from './support/extended-api'
import {
  SKIP_REASON,
  ask,
  chatbotAvailable,
  foodsById,
  openChatPanel,
  signIn,
} from './support/chatbot'

const demoEmail = 'tuanpham@demo.com'

const openChat = async (page: Page) => {
  await openChatPanel(page)
}

test('Chat panel expands, collapses and closes with Escape', async ({ page }) => {
  await openChat(page)
  const panel = page.getByTestId('chatbot-panel')
  const before = await panel.boundingBox()
  expect(before?.width ?? 0).toBeLessThan(500)

  await page.getByRole('button', { name: 'Mở rộng khung chat' }).click()
  const collapse = page.getByRole('button', { name: 'Thu nhỏ khung chat' })
  await expect(collapse).toHaveAttribute('aria-pressed', 'true')

  const viewport = page.viewportSize()
  const expanded = await panel.boundingBox()
  expect(expanded?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) - 2)
  expect(expanded?.height ?? 0).toBeGreaterThan((viewport?.height ?? 0) - 60)
  await expect(page.getByTestId('chatbot-launcher')).toHaveCount(0)

  await collapse.click()
  const collapsed = await panel.boundingBox()
  expect(collapsed?.width ?? 0).toBeLessThan(500)
  await expect(page.getByTestId('chatbot-launcher')).toBeVisible()

  await page.getByRole('button', { name: 'Mở rộng khung chat' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở rộng khung chat' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('chatbot-panel')).toHaveCount(0)
})

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Hides the expand button because the panel already fills the screen', async ({ page }) => {
    await openChat(page)
    await expect(page.getByRole('button', { name: 'Mở rộng khung chat' })).toBeHidden()
    // Dung clientWidth (bo qua animation scale) de so voi be rong noi dung cua cum.
    const fillsContainer = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="chatbot-panel"]')
      const container = panel?.parentElement
      if (!panel || !container) return false
      const style = getComputedStyle(container)
      const contentWidth =
        container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      return Math.abs(panel.clientWidth - contentWidth) < 1
    })
    expect(fillsContainer).toBe(true)
  })
})

/**
 * Lich su duoc mock nen khong can khoa AI. Token that van lay tu API roi ghi vao storage
 * de vao thang trang chu, vi form login khong gan label voi input.
 */
test.describe('conversation history', () => {
  const foodCard = {
    id: 1,
    name: 'Cơm tấm sườn',
    imageUrl: null,
    categoryName: 'Món chính',
  }

  const sessionSummary = (sessionId: string, title: string, updatedAt: string, messageCount = 2) => ({
    sessionId,
    title,
    updatedAt,
    messageCount,
  })

  const historyDetails = (): Record<string, unknown> => {
    const now = Date.now()
    return {
      'session-lunch': {
        sessionId: 'session-lunch',
        messages: [
          { id: 1, sender: 'USER', content: 'Cho 2 người 200k', foods: null, intent: null, citations: null, quickReplies: null, createdAt: new Date(now - 60_000).toISOString() },
          { id: 2, sender: 'BOT', content: 'Mình gợi ý 2 món nhé!', foods: [foodCard], intent: 'FOOD', citations: null, quickReplies: ['Món khác'], createdAt: new Date(now - 59_000).toISOString() },
        ],
      },
      'session-veg': {
        sessionId: 'session-veg',
        messages: [
          { id: 3, sender: 'USER', content: 'Món chay không cay', foods: null, intent: null, citations: null, quickReplies: null, createdAt: new Date(now - 86_400_000).toISOString() },
          { id: 4, sender: 'BOT', content: 'Món chay đây bạn nhé!', foods: [], intent: 'FOOD', citations: null, quickReplies: null, createdAt: new Date(now - 86_399_000).toISOString() },
        ],
      },
    }
  }

  // Gia lap ba endpoint lich su; xoa mem bang danh sach id de lan tai sau khong con phien do.
  const mockHistory = async (page: Page) => {
    const details = historyDetails()
    const deleted = new Set<string>()
    const sessions = () => [
      sessionSummary('session-lunch', 'Cho 2 người 200k', new Date(Date.now() - 60_000).toISOString()),
      sessionSummary('session-veg', 'Món chay không cay', new Date(Date.now() - 86_400_000).toISOString()),
    ].filter((s) => !deleted.has(s.sessionId))

    await page.route('**/api/chatbot/sessions**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const match = /\/api\/chatbot\/sessions\/(?<id>.+)$/.exec(path)
      const sessionId = match?.groups?.id ? decodeURIComponent(match.groups.id) : null

      if (request.method() === 'DELETE' && sessionId) {
        deleted.add(sessionId)
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
      if (request.method() === 'GET' && sessionId === null) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions()) })
      }
      if (request.method() === 'GET' && sessionId !== null) {
        const detail = details[sessionId === 'latest' ? 'session-lunch' : sessionId]
        if (!detail) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Không tìm thấy hội thoại' }) })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail) })
      }
      return route.continue()
    })
  }

  const signInWithToken = async (page: Page, request: APIRequestContext) => {
    const session = await apiLogin(request, demoEmail)
    await page.addInitScript((user) => localStorage.setItem('auth', JSON.stringify(user)), session)
    await page.goto('/')
  }

  test('Guests get 401 for history and see no history button', async ({ page, request }) => {
    const res = await request.get(`${API_URL}/chatbot/sessions`)
    expect(res.status()).toBe(401)

    await page.goto('/')
    await openChat(page)
    await expect(page.getByTestId('chatbot-history-open')).toHaveCount(0)
  })

  test('Signed-in customers get their latest conversation back with food cards', async ({ page, request }) => {
    await mockHistory(page)
    await signInWithToken(page, request)
    await openChat(page)

    await expect(page.getByTestId('chatbot-bot-message').filter({ hasText: 'Mình gợi ý 2 món nhé!' })).toBeVisible()
    await expect(page.getByTestId('chatbot-food-card')).toHaveCount(1)
    await expect(page.getByTestId('chatbot-food-card')).toContainText('Cơm tấm sườn')
    await expect(page.getByTestId('chatbot-history-open')).toBeVisible()
  })

  test('History list reopens an older session and deletes sessions', async ({ page, request }) => {
    await mockHistory(page)
    await signInWithToken(page, request)
    await openChat(page)

    await page.getByTestId('chatbot-history-open').click()
    await expect(page.getByTestId('chatbot-history')).toBeVisible()
    await expect(page.getByTestId('chatbot-history-item')).toHaveCount(2)
    await expect(page.getByText('Đang mở')).toHaveCount(1)

    await page.getByTestId('chatbot-history-item').filter({ hasText: 'Món chay không cay' }).click()
    await expect(page.getByTestId('chatbot-history')).toHaveCount(0)
    await expect(page.getByTestId('chatbot-bot-message').filter({ hasText: 'Món chay đây bạn nhé!' })).toBeVisible()

    await page.getByTestId('chatbot-history-open').click()
    await expect(page.getByTestId('chatbot-history-item')).toHaveCount(2)

    await page.getByTestId('chatbot-history-delete').first().click()
    await page.getByRole('button', { name: 'Xoá', exact: true }).click()
    await expect(page.getByTestId('chatbot-history-item')).toHaveCount(1)

    await page.getByTestId('chatbot-history-delete').click()
    await page.getByRole('button', { name: 'Xoá', exact: true }).click()
    await expect(page.getByTestId('chatbot-history-item')).toHaveCount(0)
    await expect(page.getByText('Chưa có hội thoại nào được lưu.')).toBeVisible()
  })

  test('Chat cache owned by another account is dropped on sign-in', async ({ page, request }) => {
    const session = await apiLogin(request, demoEmail)
    // Khong co phien tren server: neu cache bi dung lai thi loi chao bien mat, test bat duoc.
    await page.route('**/api/chatbot/sessions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    const foreignCache = {
      ownerId: session.id + 1,
      sessionId: 'session-foreign',
      messages: [
        { sender: 'USER', content: 'Câu hỏi của tài khoản trước' },
        { sender: 'BOT', content: 'Món riêng của tài khoản trước' },
      ],
    }
    await page.addInitScript(
      ([user, cache]: [typeof session, typeof foreignCache]) => {
        localStorage.setItem('auth', JSON.stringify(user))
        localStorage.setItem('chatbot.state', JSON.stringify(cache))
      },
      [session, foreignCache],
    )
    await page.goto('/')
    await openChat(page)

    await expect(page.getByText('Món riêng của tài khoản trước')).toHaveCount(0)
    await expect(page.getByText('Chào quý khách! Tôi là trợ lý đặt món của quán.')).toBeVisible()
  })
})

/**
 * Hai ca dai dien cho luong co AI that. Bo qua khi khong co khoa de e2e van chay duoc o CI.
 */
test.describe('AI suggestions', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test.beforeEach(async ({ request }) => {
    const available = await chatbotAvailable(request)
    test.skip(!available, SKIP_REASON)
  })

  test('Filters out spicy dishes and seafood', async ({ page, request }) => {
    await signIn(page)
    await openChat(page)
    const { body } = await ask(page, 'Tôi muốn ăn món Việt, không cay và không có hải sản')

    expect(body.foods.length).toBeGreaterThan(0)
    await expect(page.getByTestId('chatbot-food-card').first()).toBeVisible({ timeout: 20_000 })

    const foods = await foodsById(request)
    for (const card of body.foods) {
      const food = foods.get(card.id)
      expect(food, `Card "${card.name}" must come from the database`).toBeTruthy()
      expect(food!.spicyLevel, `${card.name} must not be spicy`).toBe(0)
      expect(food!.allergens.toLowerCase(), `${card.name} must not contain seafood`).not.toContain('hải sản')
    }
  })

  test('Suggests dishes for 4 people within a 200.000đ total budget', async ({ page, request }) => {
    await signIn(page)
    await openChat(page)
    const { body } = await ask(page, 'Gợi ý món ăn cho 4 người trong tầm giá 200.000đ')

    expect(body.foods.length).toBeGreaterThan(0)
    expect(body.foods.length).toBeLessThanOrEqual(5)

    const foods = await foodsById(request)
    for (const card of body.foods) {
      const food = foods.get(card.id)
      expect(food, `Card "${card.name}" must come from the database`).toBeTruthy()
      expect(Number(food!.price), `${card.name} must stay within the per-dish budget`).toBeLessThanOrEqual(50_000)
    }
  })
})
