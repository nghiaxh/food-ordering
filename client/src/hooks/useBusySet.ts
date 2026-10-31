import { useCallback, useState } from 'react'

/**
 * Quản lý các id đang bận (đang xóa/đang đổi trạng thái) để nút tương ứng hiện loading.
 * Gom ba bản cài đặt Set<number> giống nhau ở trang món, đơn hàng, khách hàng.
 * `mark` cố định tham chiếu nên có thể đưa thẳng vào effect deps.
 */
export default function useBusySet() {
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())
  const mark = useCallback((id: number, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  return { busyIds, mark }
}
