import { expect, test } from '@playwright/test'
import {
  apiLogin,
  clearCart,
  foodIdByName,
  loginInBrowser,
  openFoodAndAdd,
} from './support/extended-api'

/**
 * Gio hang va dat mon COD. Dung tai khoan khong co gio seed va mon khong nam trong khuyen mai
 * de tong tien khong phu thuoc ngay chay. Cac test chia se gio nen chay serial.
 */
const CART_EMAIL = 'tunghoang@demo.com'
const FOOD_NAME = 'Bún chả Hà Nội'
const UNIT_PRICE = '60.000đ'

test.describe.configure({ mode: 'serial' })

let foodId: number

test.beforeEach(async ({ request, page }) => {
  const session = await apiLogin(request, CART_EMAIL)
  await clearCart(request, session.token)
  foodId = await foodIdByName(request, FOOD_NAME)
  await loginInBrowser(page, CART_EMAIL)
})

test('Adds a dish from its detail page and opens the cart', async ({ page }) => {
  await openFoodAndAdd(page, { id: foodId, name: FOOD_NAME })

  const drawer = page.getByRole('dialog')
  await expect(drawer.getByTestId('cart-line')).toHaveCount(1)
  await expect(drawer.getByTestId('cart-line-total')).toHaveText(UNIT_PRICE)
  await expect(drawer.getByTestId('cart-total')).toHaveText(UNIT_PRICE)
  await expect(page).toHaveURL(new RegExp(`/foods/${foodId}$`))
})

test('Changing quantity refreshes the quote and opens checkout', async ({ page }) => {
  await openFoodAndAdd(page, { id: foodId, name: FOOD_NAME })

  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Tăng số lượng' }).click()
  await expect(drawer.getByTestId('cart-total')).toHaveText('120.000đ')
  await expect(drawer.getByTestId('cart-line-total')).toHaveText('120.000đ')

  await drawer.getByRole('button', { name: 'Giảm số lượng' }).click()
  await expect(drawer.getByTestId('cart-total')).toHaveText(UNIT_PRICE)
  await expect(drawer.getByTestId('cart-line-total')).toHaveText(UNIT_PRICE)

  await drawer.getByRole('button', { name: 'Đặt món', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByText('Tổng thanh toán').first()).toBeVisible()
})

test('Places a COD order and shows it as pending', async ({ page }) => {
  await openFoodAndAdd(page, { id: foodId, name: FOOD_NAME })
  await page.getByRole('dialog').getByRole('button', { name: 'Đặt món', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  // NFormItem cua naive-ui khong gan label voi input nen dinh vi theo form va nhan cua tung o.
  const form = page.locator('#checkout-form')
  await form.locator('.n-form-item').filter({ hasText: 'Người nhận' }).locator('input').fill('Nguyễn Văn Test')
  await form.getByPlaceholder('0900000000').fill('0901234567')
  await form.locator('.n-form-item').filter({ hasText: 'Địa chỉ nhận món' }).locator('textarea').fill('123 Đường Test, Cần Thơ')

  const cod = form.getByRole('radio', { name: /Tiền mặt khi nhận/ })
  await expect(cod).toBeChecked()
  await expect(form.getByRole('radio', { name: /Chuyển khoản QR/ })).not.toBeChecked()
  await form.locator('.n-radio').filter({ hasText: 'Tiền mặt khi nhận' }).click()

  // Nut desktop; thanh day mobile dung nhan "Dat mon" va an o viewport lg.
  await page.getByRole('button', { name: 'Xác nhận đặt món' }).click()
  await expect(page).toHaveURL(/\/orders$/)
  const newest = page.locator('[id^="order-"]').first()
  await expect(newest).toBeVisible()
  await expect(newest.getByText(FOOD_NAME).first()).toBeVisible()
  await expect(newest.locator('.n-tag', { hasText: 'Chờ xác nhận' })).toBeVisible()
  await expect(newest.locator('.n-tag', { hasText: 'Chưa thanh toán' })).toBeVisible()
  await expect(newest.getByText('Tiền mặt khi nhận', { exact: true })).toBeVisible()
})

test('Empty cart offers a way back to the menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Giỏ hàng', exact: true }).click()

  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Giỏ hàng đang trống')).toBeVisible()
  await drawer.getByRole('button', { name: 'Xem thực đơn' }).click()

  await expect(page.getByText('Giỏ hàng đang trống')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})
