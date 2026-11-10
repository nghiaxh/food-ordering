import { expect, test } from '@playwright/test'
import { apiLogin, clearCart, loginInBrowser } from './support/extended-api'

const CUSTOMER_EMAIL = 'tuanpham@demo.com'
const FOOD_NAME = 'Phở bò'

/**
 * Luồng đặt món COD thật trên dev stack: xoá giỏ của tài khoản demo trước mỗi test
 * để không phụ thuộc dữ liệu cũ, và đặt với tên/điện thoại/địa chỉ cố định.
 * Mỗi lần chạy tạo một đơn mới trong CSDL dev (CI dùng `down -v` nên sạch).
 */
test.describe('E2E - Luồng Đặt món & Thanh toán', () => {
  test.beforeEach(async ({ request, page }) => {
    const session = await apiLogin(request, CUSTOMER_EMAIL)
    await clearCart(request, session.token)
    await loginInBrowser(page, CUSTOMER_EMAIL)
  })

  test('Thêm món vào giỏ và đặt hàng COD thành công', async ({ page }) => {
    const addButton = page.getByRole('button', { name: `Thêm ${FOOD_NAME} vào giỏ` })
    await expect(addButton).toBeVisible()
    await addButton.hover()
    await addButton.click()
    await expect(page.getByText(`Đã thêm ${FOOD_NAME} vào giỏ`)).toBeVisible()

    // 2. Mở drawer giỏ từ header rồi sang trang đặt món
    await page.getByRole('button', { name: 'Giỏ hàng', exact: true }).click()
    const checkoutButton = page.getByRole('button', { name: 'Đặt món', exact: true })
    await expect(checkoutButton).toBeEnabled()
    await checkoutButton.click()

    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText(FOOD_NAME).first()).toBeVisible()

    // 3. Điền thông tin giao hàng
    await page.getByLabel('Người nhận').fill('Nguyễn Văn Test')
    await page.getByLabel('Số điện thoại').fill('0901234567')
    await page.getByLabel('Địa chỉ nhận món').fill('123 Đường Test, Cần Thơ')

    // 4. COD là mặc định; chọn lại để khoá hành vi
    await page.getByRole('radio', { name: /Tiền mặt khi nhận/ }).click()

    // 5. Xác nhận đặt món (nút desktop; nút mobile ẩn ở viewport lg)
    const confirm = page.getByRole('button', { name: 'Xác nhận đặt món' })
    await expect(confirm).toBeEnabled()
    await confirm.click()

    // 6. Điều hướng về /orders và thấy đơn mới
    await expect(page).toHaveURL(/\/orders$/)
    await expect(page.getByText('Chờ xác nhận').first()).toBeVisible()
  })
})
