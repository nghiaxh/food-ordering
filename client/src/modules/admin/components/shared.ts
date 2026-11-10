// Thiết lập xác nhận xóa dùng chung: mọi thao tác xóa đều đồng bộ, không tự viết lại từng lần.
import { dialog } from '@/shared/api/message'
import type { AsyncActionResult } from '@/composables/useAsyncAction'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'

/** Hộp thoại xác nhận xóa; nút xác nhận là nút nguy hiểm. */
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
 * Dàn bài chung cho một thao tác quản trị: thông báo thành công rồi chạy phần dọn dẹp
 * (đóng modal, tải lại bảng), lỗi thì hiện thông điệp từ server hoặc dòng dự phòng.
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
