import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  apiLogin,
  createOrder,
  deleteNotificationsForOrder,
  firstAvailableFoodId,
  getNotifications,
  loginInBrowser,
  markNotificationRead,
  type DemoSession,
} from './support/extended-api'

/**
 * Thong bao. `duchoang` khong co thong bao seed nen moi test tu tao don de sinh thong bao
 * "da duoc tao", roi don dung thong bao cua don minh tao trong `afterEach`.
 */
const NOTIFICATION_EMAIL = 'duchoang@demo.com'
const RECEIVER = {
  fullName: 'Hoàng Minh Đức',
  phone: '0901000009',
  address: '123 Đường Test, Ninh Kiều, Cần Thơ',
}

// Cung mot tai khoan va cung danh sach thong bao; chay song song se xoa lan thong bao cua nhau.
test.describe.configure({ mode: 'serial' })

// Chuong thong bao chi co nut rieng tren header tu `lg`; ep viewport desktop de test
// khong phu thuoc project mobile cua cau hinh Playwright.
test.use({ viewport: { width: 1280, height: 900 } })

let session: DemoSession
let foodId: number
let createdOrderIds: number[] = []

test.beforeEach(async ({ request, page }) => {
  session = await apiLogin(request, NOTIFICATION_EMAIL)
  foodId = await firstAvailableFoodId(request)
  createdOrderIds = []
  await loginInBrowser(page, NOTIFICATION_EMAIL)
})

test.afterEach(async ({ request }) => {
  if (!session) return
  for (const orderId of createdOrderIds) {
    await deleteNotificationsForOrder(request, session.token, orderId)
  }
})

async function createNotificationOrder(request: APIRequestContext): Promise<number> {
  const order = await createOrder(request, session.token, foodId, RECEIVER)
  createdOrderIds.push(order.id)
  return order.id
}

function itemFor(page: import('@playwright/test').Page, orderId: number) {
  // `\b` de `#16` khong khop nham noi dung `#160`.
  return page.getByTestId('notification-item').filter({ hasText: new RegExp(`#${orderId}\\b`) })
}

async function openNotifications(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^Thông báo/ }).click()
  // Cho danh sach tai xong thay vi bam vao class noi bo cua AntD.
  await expect(page.getByTestId('notification-item').first()).toBeVisible()
}

test('đánh dấu tất cả đã đọc xoá huy hiệu chưa đọc', async ({ page, request }) => {
  const orderId = await createNotificationOrder(request)
  await page.goto('/')
  await openNotifications(page)

  const item = itemFor(page, orderId)
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('data-read', 'false')

  await page.getByRole('button', { name: 'Đã đọc', exact: true }).click()

  await expect(item).toHaveAttribute('data-read', 'true')
  await expect(page.getByText(/\d+ mới/)).toHaveCount(0)
})

test('bấm thông báo mở đúng đơn và đánh dấu đã đọc', async ({ page, request }) => {
  const orderId = await createNotificationOrder(request)
  await page.goto('/')
  await openNotifications(page)

  const item = itemFor(page, orderId)
  await expect(item).toBeVisible()
  await item.getByRole('button').first().click()

  await expect(page).toHaveURL(new RegExp(`/orders\\?orderId=${orderId}$`))
  await expect(page.locator(`#order-${orderId}`)).toHaveClass(/ring-amber-500/)

  await openNotifications(page)
  await expect(itemFor(page, orderId)).toHaveAttribute('data-read', 'true')
})

test('xóa đã đọc chỉ xoá thông báo đã đọc, giữ lại thông báo mới', async ({ page, request }) => {
  const readOrderId = await createNotificationOrder(request)
  const unreadOrderId = await createNotificationOrder(request)

  const readNotification = (await getNotifications(request, session.token)).find(
    (n) => n.orderId === readOrderId,
  )
  expect(readNotification).toBeTruthy()
  await markNotificationRead(request, session.token, readNotification!.id)

  await page.goto('/')
  await openNotifications(page)

  const readItem = itemFor(page, readOrderId)
  const unreadItem = itemFor(page, unreadOrderId)
  await expect(readItem).toHaveAttribute('data-read', 'true')
  await expect(unreadItem).toHaveAttribute('data-read', 'false')

  await page.getByRole('button', { name: 'Xóa đã đọc', exact: true }).click()

  await expect(readItem).toHaveCount(0)
  await expect(unreadItem).toBeVisible()
  await expect(unreadItem).toHaveAttribute('data-read', 'false')
})
