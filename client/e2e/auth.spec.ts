import { expect, test } from '@playwright/test'
import { demoPassword } from './support/extended-api'

test.describe('E2E - User authentication', () => {
  test('Demo account can sign in', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('tuanpham@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await page.waitForURL((url) => url.pathname === '/')
    // Header chi hien avatar voi aria-label "Menu tai khoan" (kem so thong bao chua doc neu co).
    await expect(page.getByRole('button', { name: /Menu tài khoản/ })).toBeVisible()
  })

  test('Header logo returns to the menu', async ({ page }) => {
    // AuthShell khong hien logo nen lay trang chu lam diem xuat phat.
    await page.goto('/')
    // Logo chi con icon nha nhung giu nguyen aria-label va RouterLink "/".
    await page.getByRole('link', { name: 'FoodOrdering, về trang chủ' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('Wrong password shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('tuanpham@demo.com')
    await page.getByLabel('Mật khẩu').fill('sai_mat_khau')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await expect(page.getByText('Mật khẩu không đúng')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('Admin account is redirected to the admin area', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('namnguyen@demo.com')
    await page.getByLabel('Mật khẩu').fill(demoPassword('namnguyen@demo.com'))
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await page.waitForURL((url) => url.pathname.startsWith('/admin'))
    await expect(page).toHaveURL(/\/admin/)
  })
})
