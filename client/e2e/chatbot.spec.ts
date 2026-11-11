import { expect, test, type Page } from '@playwright/test'
import { API_URL } from './support/extended-api'

/**
 * Chatbot: cau hoi tu van mon chay khong cay.
 *
 * Server can khoa AI that de goi model. Khi `/chatbot/status` bao `available = false`
 * (khoa rong, sai hoac bi tu choi), khung chat hien banner "Tro ly AI chua duoc cau
 * hinh" va khoa o nhap — nhanh do cung duoc kiem tra thay vi fail, vi CI dung khoa gia
 * trong `.env.example`.
 */
const SKIP_REASON =
  'Chatbot chưa cấu hình khóa AI (AI_API_KEY rỗng hoặc bị từ chối); đặt khóa thật rồi chạy lại.'

// Luot chat la hai cuoc goi AI 15s timeout nen noi test timeout so voi mac dinh 30s.
test.describe.configure({ timeout: 60_000 })

// Tin bot chay chu dan; reducedMotion lam chu hien du ngay, the mon xuat hien som hon.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

async function chatbotAvailable(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`${API_URL}/chatbot/status`)
  if (!res.ok()) return false
  const status = (await res.json()) as { available?: boolean }
  return status.available === true
}

async function openChat(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở trợ lý' }).click()
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
}

test('hỏi tư vấn món chay không cay', async ({ page, request }) => {
  const available = await chatbotAvailable(request)
  await openChat(page)

  if (!available) {
    await expect(page.getByText('Trợ lý AI chưa được cấu hình')).toBeVisible()
    await expect(page.getByLabel('Nhập câu hỏi cho chatbot')).toBeDisabled()
    test.info().annotations.push({ type: 'note', description: SKIP_REASON })
    return
  }

  const botMessages = page.getByTestId('chatbot-bot-message')
  const before = await botMessages.count()

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/chatbot/chat') && res.request().method() === 'POST',
  )
  await page.getByLabel('Nhập câu hỏi cho chatbot').fill('Tư vấn món chay không cay')
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()

  const response = await responsePromise
  expect(response.status(), 'Chatbot phải trả 200 khi đã cấu hình khóa').toBe(200)

  await expect(botMessages).toHaveCount(before + 1, { timeout: 20_000 })
  await expect(page.getByTestId('chatbot-food-card').first()).toBeVisible({ timeout: 20_000 })
})
