import { dialog } from '@/shared/api/message'
import type { AsyncActionResult } from '@/composables/useAsyncAction'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'

/** Hop thoai xac nhan xoa; nut xac nhan la nut nguy hiem. */
export const confirmRemove = (opts: {
  title: string
  content?: string
  onOk: () => Promise<unknown> | unknown
}) => {
  dialog.warning({
    title: opts.title,
    content: opts.content,
    positiveText: 'Xóa',
    negativeText: 'Hủy',
    onPositiveClick: () => Promise.resolve(opts.onOk()),
  })
}

/**
 * Dan bai chung cho mot thao tac quan tri: thong bao thanh cong roi chay phan don dep
 * (dong modal, tai lai bang), loi thi hien thong diep tu server hoac dong du phong.
 */
export const runAndMessage = async <T>(
  res: AsyncActionResult<T>,
  opts: { success: string; fallback: string; onSuccess?: () => void },
) => {
  if (res.ok) {
    message.success(opts.success)
    opts.onSuccess?.()
  } else {
    message.error(apiErrorMessage(res.error) ?? opts.fallback)
  }
}
