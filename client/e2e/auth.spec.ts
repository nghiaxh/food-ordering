import { expect, test } from '@playwright/test'
import { demoPassword } from './support/extended-api'

test.describe('E2E - Xác thực người dùng', () => {
  test('Đăng nhập thành công với tài khoản demo', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('tuanpham@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    // Header chỉ hiện avatar với aria-label "Menu tài khoản" (kèm số thông báo chưa đọc nếu có).
    await expect(page.getByRole('button', { name: /Menu tài khoản/ })).toBeVisible()
  })

  test('Hiển thị lỗi khi sai mật khẩu', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu').fill('sai_mat_khau')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await expect(page.getByText('Mật khẩu không đúng')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('Tài khoản quản trị đăng nhập được đưa về khu quản trị', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('namnguyen@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('namnguyen@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await page.waitForURL((url) => url.pathname.startsWith('/admin'))
    await expect(page).toHaveURL(/\/admin/)
  })
})
