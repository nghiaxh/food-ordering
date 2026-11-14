import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, apiLogin } from './support/extended-api'

/**
 * Lich su chatbot: khach vang lai khong co quyen, khach da dang nhap mo lai duoc hoi thoai
 * cu kem the mon va xoa duoc tung phien. Cac phan hoi lich su duoc mock nen khong can
 * `AI_API_KEY`; token van lay tu API that roi ghi vao storage de vao thang trang chu.
 */
const demoEmail = 'tuanpham@demo.com'

const foodCard = {
  id: 1,
  name: 'Cơm tấm sườn',
  price: '45000',
  imageUrl: null,
  categoryName: 'Món chính',
  portions: 2,
  totalPrice: '90000',
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

/** Gia lap ba endpoint lich su; xoa mem bang danh sach id de lan tai sau khong con phien do. */
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
      const detail = details[sessionId]
      if (!detail) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Không tìm thấy hội thoại' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail) })
    }
    return route.continue()
  })
}

const openChat = async (page: Page) => {
  await page.getByRole('button', { name: 'Mở trợ lý' }).click()
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
}

/**
 * Ghi san token vao storage de auth store doc luc khoi dong, khong phu thuoc form dang nhap
 * (form naive-ui khong gan label voi input nen `getByLabel` khong bam duoc).
 */
const signIn = async (page: Page, request: APIRequestContext) => {
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
  await signIn(page, request)
  await openChat(page)

  await expect(page.getByTestId('chatbot-bot-message').filter({ hasText: 'Mình gợi ý 2 món nhé!' })).toBeVisible()
  await expect(page.getByTestId('chatbot-food-card')).toHaveCount(1)
  await expect(page.getByTestId('chatbot-food-card')).toContainText('Cơm tấm sườn')
  await expect(page.getByTestId('chatbot-history-open')).toBeVisible()
})

test('History list reopens an older session and deletes sessions', async ({ page, request }) => {
  await mockHistory(page)
  await signIn(page, request)
  await openChat(page)

  await page.getByTestId('chatbot-history-open').click()
  await expect(page.getByTestId('chatbot-history')).toBeVisible()
  await expect(page.getByTestId('chatbot-history-item')).toHaveCount(2)
  // Phien vua nap tu server duoc danh dau la dang mo.
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
