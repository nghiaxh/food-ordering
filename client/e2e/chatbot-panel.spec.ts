import { expect, test, type Page } from '@playwright/test'

/**
 * Khung chat mo rong: panel phu kin vung duoi header, Esc thu nho truoc roi moi dong.
 * Khong can khoa AI vi test khong gui cau hoi nao.
 */
const openChat = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở trợ lý' }).click()
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
}

test('Expands chat panel to the area under the header', async ({ page }) => {
  await openChat(page)
  const panel = page.getByTestId('chatbot-panel')
  const before = await panel.boundingBox()
  expect(before?.width ?? 0).toBeLessThan(500)

  await page.getByRole('button', { name: 'Mở rộng khung chat' }).click()
  const collapse = page.getByRole('button', { name: 'Thu nhỏ khung chat' })
  await expect(collapse).toHaveAttribute('aria-pressed', 'true')

  const viewport = page.viewportSize()
  const expanded = await panel.boundingBox()
  expect(expanded?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) - 2)
  expect(expanded?.height ?? 0).toBeGreaterThan((viewport?.height ?? 0) - 60)
  await expect(page.getByTestId('chatbot-launcher')).toHaveCount(0)

  await collapse.click()
  const collapsed = await panel.boundingBox()
  expect(collapsed?.width ?? 0).toBeLessThan(500)
  await expect(page.getByTestId('chatbot-launcher')).toBeVisible()
})

test('Escape collapses the expanded panel before closing it', async ({ page }) => {
  await openChat(page)
  await page.getByRole('button', { name: 'Mở rộng khung chat' }).click()
  await expect(page.getByRole('button', { name: 'Thu nhỏ khung chat' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('chatbot-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở rộng khung chat' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('chatbot-panel')).toHaveCount(0)
})

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Hides the expand button because the panel already fills the screen', async ({ page }) => {
    await openChat(page)
    await expect(page.getByRole('button', { name: 'Mở rộng khung chat' })).toBeHidden()
    // Dung clientWidth (bo qua animation scale) va so voi be rong noi dung cua cum.
    const fillsContainer = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="chatbot-panel"]')
      const container = panel?.parentElement
      if (!panel || !container) return false
      const style = getComputedStyle(container)
      const contentWidth =
        container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      return Math.abs(panel.clientWidth - contentWidth) < 1
    })
    expect(fillsContainer).toBe(true)
  })
})
