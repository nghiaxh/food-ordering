import { expect, test } from '@playwright/test'
import { demoPassword, loginInBrowser } from './support/extended-api'

test.describe('E2E - Admin access guard', () => {
  test('Regular customer is blocked from the admin page', async ({ page }) => {
    await loginInBrowser(page, 'tuanpham@demo.com')

    await page.goto('/admin/dashboard')

    // RequireAuth phia client dieu huong ve trang chu; quyen that van do server kiem tra.
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Đơn hàng' })).toHaveCount(0)
  })

  test('Admin signs in and manages orders', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('namnguyen@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('namnguyen@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.waitForURL((url) => url.pathname.startsWith('/admin'))

    await page.goto('/admin/orders')
    await expect(page).toHaveURL('/admin/orders')
    // PageHeader render h2; menu ben trai dung link nen khong trung role heading.
    await expect(page.getByRole('heading', { name: 'Đơn hàng' })).toBeVisible()
  })

  test('Admin can open management pages', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('namnguyen@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('namnguyen@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.waitForURL((url) => url.pathname.startsWith('/admin'))

    const pages = [
      { path: '/admin/orders', heading: 'Đơn hàng' },
      { path: '/admin/foods', heading: 'Món ăn' },
      { path: '/admin/reports', heading: 'Báo cáo' },
    ]
    for (const p of pages) {
      await page.goto(p.path)
      await expect(page).toHaveURL(p.path, { timeout: 10_000 })
      await expect(page.getByRole('heading', { name: p.heading })).toBeVisible({ timeout: 10_000 })
    }
  })
})
