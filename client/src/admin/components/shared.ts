import { dialog } from '@/shared/api/message'
import type { AsyncActionResult } from '@/composables/useAsyncAction'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'

/**
 * Mau cua cham trang thai. Dung class Tailwind thay vi hex noi tuy nen doi mau
 * duoc theo bang mau chuan cua Tailwind ma khong can them gia tri mau tay.
 */
export type StatusTone = 'success' | 'warning' | 'info' | 'progress' | 'danger' | 'neutral'

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-orange-500',
  info: 'bg-sky-500',
  progress: 'bg-violet-500',
  danger: 'bg-rose-500',
  neutral: 'bg-stone-400',
}

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
