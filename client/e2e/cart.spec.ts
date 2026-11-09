import { expect, test } from '@playwright/test'
import { apiLogin, clearCart, loginInBrowser } from './support/extended-api'

/**
 * Giỏ hàng và báo giá. Dùng tài khoản không có giỏ seed (`tunghoang`) và món không nằm
 * trong khuyến mãi nào (`Bún chả Hà Nội`) để tổng tiền không phụ thuộc ngày chạy.
 */
const CART_EMAIL = 'tunghoang@demo.com'
const FOOD_NAME = 'Bún chả Hà Nội'
const UNIT_PRICE = '60.000đ'

// Các test dùng chung một tài khoản và cùng xoá giỏ ở `beforeEach`; chạy song song sẽ
// tranh nhau xoá đúng dòng món test khác vừa thêm.
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ request, page }) => {
  const session = await apiLogin(request, CART_EMAIL)
  await clearCart(request, session.token)
  await loginInBrowser(page, CART_EMAIL)
  await page.goto('/')
})

/** Thêm món qua nút dấu cộng trên thẻ; nút chỉ hiện rõ khi rê chuột vào thẻ. */
async function addFromCard(page: import('@playwright/test').Page) {
  const addButton = page.getByRole('button', { name: `Thêm ${FOOD_NAME} vào giỏ` })
  await expect(addButton).toBeVisible()
  await addButton.hover()
  await addButton.click()
}

async function openCart(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Giỏ hàng', exact: true }).click()
}

test('thêm món từ thẻ hiện thông báo và không tự mở giỏ', async ({ page }) => {
  await addFromCard(page)

  await expect(page.getByText(`Đã thêm ${FOOD_NAME} vào giỏ`, { exact: true })).toBeVisible()
  // Thêm nhanh không được đẩy khách ra khỏi bảng món hay mở drawer ngoài ý muốn.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Đặt món', exact: true })).toHaveCount(0)
  await expect(page.getByText('Giỏ hàng đang trống')).toHaveCount(0)
})

test('tăng giảm số lượng trong giỏ cập nhật lại báo giá', async ({ page }) => {
  await addFromCard(page)
  await openCart(page)

  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-total')).toHaveText(UNIT_PRICE)

  await page.getByRole('button', { name: 'Tăng số lượng' }).click()
  await expect(page.getByTestId('cart-total')).toHaveText('120.000đ')

  await page.getByRole('button', { name: 'Giảm số lượng' }).click()
  await expect(page.getByTestId('cart-total')).toHaveText(UNIT_PRICE)
  await expect(page.getByTestId('cart-line-total')).toHaveText(UNIT_PRICE)
})

test('nút đặt món trong giỏ mở trang thanh toán', async ({ page }) => {
  await addFromCard(page)
  await openCart(page)

  const checkout = page.getByRole('button', { name: 'Đặt món', exact: true })
  await expect(checkout).toBeEnabled()
  await checkout.click()

  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByText(FOOD_NAME, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Tổng thanh toán')).toBeVisible()
})

test('giỏ trống có lối quay lại thực đơn', async ({ page }) => {
  await openCart(page)

  await expect(page.getByText('Giỏ hàng đang trống')).toBeVisible()
  await page.getByRole('button', { name: 'Xem thực đơn' }).click()

  await expect(page.getByText('Giỏ hàng đang trống')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})
