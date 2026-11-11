import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  apiLogin,
  createReview,
  deleteMyReviews,
  findMyReview,
  foodIdByName,
  loginInBrowser,
  type DemoSession,
} from './support/extended-api'

/**
 * Danh gia mon. `thaotran` co don hoan thanh chua `Nuoc cam ep` va mon nay chua co
 * danh gia seed, nen moi test so huu dung mot danh gia cua chinh minh.
 */
const REVIEW_EMAIL = 'thaotran@demo.com'
const FOOD_NAME = 'Nước cam ép'
const REVIEWER_NAME = 'Trần Phương Thảo'
const COMMENT = 'Ngon, sẽ quay lại'

// Chung mot tai khoan + mot mon: chay song song thi buoc don danh gia cua test nay xoa mat
// danh gia test kia vua tao.
test.describe.configure({ mode: 'serial' })

let session: DemoSession
let foodId: number

test.beforeEach(async ({ request, page }) => {
  session = await apiLogin(request, REVIEW_EMAIL)
  foodId = await foodIdByName(request, FOOD_NAME)
  await deleteMyReviews(request, session.token, foodId)
  await loginInBrowser(page, REVIEW_EMAIL)
})

test.afterEach(async ({ request }) => {
  if (!session || !foodId) return
  await deleteMyReviews(request, session.token, foodId)
})

async function openFoodPage(page: import('@playwright/test').Page) {
  await page.goto(`/foods/${foodId}`)
  await expect(page.getByRole('heading', { name: FOOD_NAME })).toBeVisible()
}

function myReviewItem(page: import('@playwright/test').Page) {
  return page.getByTestId('review-item').filter({ hasText: REVIEWER_NAME })
}

async function expectApiReview(
  request: APIRequestContext,
  expected: { rating: number; comment: string | null },
) {
  await expect
    .poll(async () => findMyReview(request, session.token, foodId))
    .toEqual(expect.objectContaining(expected))
}

test('Rating only still submits a review without an empty comment', async ({ page, request }) => {
  await openFoodPage(page)

  await page.getByRole('radio', { name: '5 trên 5 sao' }).click()
  const submit = page.getByRole('button', { name: 'Gửi đánh giá' })
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page.getByText('Cảm ơn bạn đã đánh giá!')).toBeVisible()
  const item = myReviewItem(page)
  await expect(item).toHaveCount(1)
  await expect(item.getByLabel('5 trên 5 sao')).toBeVisible()
  // Nhan xet khong bat buoc: cham sao xong khong nhap gi thi khong duoc hien doan van rong.
  await expect(item.getByTestId('review-comment')).toHaveCount(0)

  await expectApiReview(request, { rating: 5, comment: null })
})

test('Editing a review and clearing the comment stores a null comment', async ({ page, request }) => {
  await createReview(request, session.token, foodId, 4, COMMENT)
  await openFoodPage(page)

  const item = myReviewItem(page)
  await expect(item).toHaveCount(1)
  await expect(item.getByTestId('review-comment')).toHaveText(COMMENT)

  await item.getByRole('button', { name: 'Sửa', exact: true }).click()
  await expect(page.getByText('Đang sửa đánh giá của bạn')).toBeVisible()

  await page.getByRole('radio', { name: '5 trên 5 sao' }).click()
  await page.locator('textarea').fill('')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()

  await expect(page.getByText('Đã cập nhật đánh giá!')).toBeVisible()
  await expect(myReviewItem(page).getByTestId('review-comment')).toHaveCount(0)
  await expect(myReviewItem(page).getByLabel('5 trên 5 sao')).toBeVisible()

  await expectApiReview(request, { rating: 5, comment: null })
})
