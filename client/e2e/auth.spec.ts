import { expect, test } from '@playwright/test'
import { demoPassword, loginInBrowser } from './support/extended-api'

test.describe('E2E - Authentication and access guard', () => {
  test('Demo account can sign in', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu', { exact: true }).fill(demoPassword('tuanpham@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    // Header chi hien avatar voi aria-label "Menu tai khoan" (kem so thong bao chua doc neu co).
    await expect(page.getByRole('button', { name: /Menu tài khoản/ })).toBeVisible()
  })

  test('Wrong password shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu', { exact: true }).fill('sai_mat_khau')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await expect(page.getByText('Mật khẩu không đúng')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('Admin signs in and can open management pages', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('namnguyen@demo.com')
    await page.getByLabel('Mật khẩu', { exact: true }).fill(demoPassword('namnguyen@demo.com'))
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

  test('Regular customer is blocked from the admin page', async ({ page }) => {
    await loginInBrowser(page, 'tuanpham@demo.com')

    await page.goto('/admin/dashboard')

    // RequireAuth phia client dieu huong ve trang chu; quyen that van do server kiem tra.
    await expect(page).toHaveURL('/', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Đơn hàng' })).toHaveCount(0, { timeout: 10_000 })
  })

  test('Header logo returns to the menu', async ({ page }) => {
    // AuthShell khong hien logo nen lay trang chu lam diem xuat phat.
    await page.goto('/')
    await page.getByRole('link', { name: 'FoodOrdering, về trang chủ' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
