import { expect, test } from '@playwright/test'
import { apiLogin, clearCart, loginInBrowser } from './support/extended-api'

const CUSTOMER_EMAIL = 'tuanpham@demo.com'
const FOOD_NAME = 'Phở bò'

/**
 * Luong dat mon COD that tren dev stack: xoa gio cua tai khoan demo truoc moi test
 * de khong phu thuoc du lieu cu, va dat voi ten/dien thoai/dia chi co dinh.
 * Moi lan chay tao mot don moi trong CSDL dev (CI dung `down -v` nen sach).
 */
test.describe('E2E - Order and payment flow', () => {
  test.beforeEach(async ({ request, page }) => {
    const session = await apiLogin(request, CUSTOMER_EMAIL)
    await clearCart(request, session.token)
    await loginInBrowser(page, CUSTOMER_EMAIL)
  })

  test('Add a dish to the cart and place a COD order', async ({ page }) => {
    const addButton = page.getByRole('button', { name: `Thêm ${FOOD_NAME} vào giỏ` })
    await expect(addButton).toBeVisible()
    await addButton.hover()
    await addButton.click()
    await expect(page.getByText(`Đã thêm ${FOOD_NAME} vào giỏ`)).toBeVisible()

    // 2. Mo drawer gio tu header roi sang trang dat mon
    await page.getByRole('button', { name: 'Giỏ hàng', exact: true }).click()
    const checkoutButton = page.getByRole('button', { name: 'Đặt món', exact: true })
    await expect(checkoutButton).toBeEnabled()
    await checkoutButton.click()

    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText(FOOD_NAME).first()).toBeVisible()

    // 3. Dien thong tin giao hang. NFormItem cua naive-ui render <label> khong co `for`
    // va NInput khong co id/aria-label, nen getByLabel khong tim thay input; dinh vi
    // theo form va nhan cua tung o.
    const form = page.locator('#checkout-form')
    await expect(form.getByText('Người nhận', { exact: true })).toBeVisible()
    await expect(form.getByText('Số điện thoại', { exact: true })).toBeVisible()
    await expect(form.getByText('Địa chỉ nhận món', { exact: true })).toBeVisible()

    await form.locator('.n-form-item').filter({ hasText: 'Người nhận' }).locator('input').fill('Nguyễn Văn Test')
    await form.getByPlaceholder('0900000000').fill('0901234567')
    await form.locator('.n-form-item').filter({ hasText: 'Địa chỉ nhận món' }).locator('textarea').fill('123 Đường Test, Cần Thơ')

    // 4. COD la mac dinh; chon lai de khoa hanh vi
    const cod = form.getByRole('radio', { name: /Tiền mặt khi nhận/ })
    await expect(cod).toBeChecked()
    await expect(form.getByRole('radio', { name: /Chuyển khoản QR/ })).not.toBeChecked()
    await cod.click()

    // 5. Xac nhan dat mon (nut desktop; thanh day mobile dung nhan "Dat mon" va an o viewport lg)
    const confirm = page.getByRole('button', { name: 'Xác nhận đặt món' })
    await expect(confirm).toBeVisible()
    await expect(confirm).toBeEnabled()
    await confirm.click()

    // 6. Dieu huong ve /orders va thay don moi
    await expect(page).toHaveURL(/\/orders$/)
    await expect(page.getByText('Chờ xác nhận').first()).toBeVisible()
  })
})
