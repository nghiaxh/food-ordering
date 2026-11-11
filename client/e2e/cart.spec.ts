import { expect, test } from '@playwright/test'
import { apiLogin, clearCart, loginInBrowser } from './support/extended-api'

/**
 * Gio hang va bao gia. Dung tai khoan khong co gio seed (`tunghoang`) va mon khong nam
 * trong khuyen mai nao (`Bun cha Ha Noi`) de tong tien khong phu thuoc ngay chay.
 */
const CART_EMAIL = 'tunghoang@demo.com'
const FOOD_NAME = 'Bún chả Hà Nội'
const UNIT_PRICE = '60.000đ'

// Cac test dung chung mot tai khoan va cung xoa gio o `beforeEach`; chay song song se
// tranh nhau xoa dung dong mon test khac vua them.
test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ request, page }) => {
  const session = await apiLogin(request, CART_EMAIL)
  await clearCart(request, session.token)
  await loginInBrowser(page, CART_EMAIL)
  await page.goto('/')
})

/** Them mon qua nut dau cong tren the; nut chi hien ro khi re chuot vao the. */
async function addFromCard(page: import('@playwright/test').Page) {
  const addButton = page.getByRole('button', { name: `Thêm ${FOOD_NAME} vào giỏ` })
  await expect(addButton).toBeVisible()
  await addButton.hover()
  await addButton.click()
}

async function openCart(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Giỏ hàng', exact: true }).click()
}

test('Adding from a card shows a toast and keeps the cart closed', async ({ page }) => {
  await addFromCard(page)

  await expect(page.getByText(`Đã thêm ${FOOD_NAME} vào giỏ`, { exact: true })).toBeVisible()
  // Them nhanh khong duoc day khach ra khoi bang mon hay mo drawer ngoai y muon.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Đặt món', exact: true })).toHaveCount(0)
  await expect(page.getByText('Giỏ hàng đang trống')).toHaveCount(0)
})

test('Changing quantity in the cart refreshes the quote', async ({ page }) => {
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

test('Checkout button in the cart opens the checkout page', async ({ page }) => {
  await addFromCard(page)
  await openCart(page)

  const checkout = page.getByRole('button', { name: 'Đặt món', exact: true })
  await expect(checkout).toBeEnabled()
  await checkout.click()

  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByText(FOOD_NAME, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Tổng thanh toán')).toBeVisible()
})

test('Empty cart offers a way back to the menu', async ({ page }) => {
  await openCart(page)

  await expect(page.getByText('Giỏ hàng đang trống')).toBeVisible()
  await page.getByRole('button', { name: 'Xem thực đơn' }).click()

  await expect(page.getByText('Giỏ hàng đang trống')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})
