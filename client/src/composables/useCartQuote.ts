import { ref, watch, type Ref } from 'vue'
import { quoteCart } from '@/modules/cart/api'
import type { CartItem, CartQuote } from '@/shared/types'

/** Bấm số lượng liên tục thì chỉ gửi báo giá một lần, tránh mỗi lần bấm một request. */
const QUOTE_DEBOUNCE_MS = 250

/**
 * Báo giá giỏ do server tính, dùng chung cho drawer giỏ và trang checkout.
 *
 * Gửi đúng danh sách dòng đang hiển thị thay vì để server đọc lại giỏ DB (request cũ có
 * thể về sau và ghi đè giỏ mới). Abort request cũ để response muộn không thắng. Giữ số cũ
 * trong lúc tính lại để khối tổng tiền không nháy sang "Đang cập nhật giá..." mỗi lần bấm.
 */
export default function useCartQuote(items: () => CartItem[]) {
  const quote: Ref<CartQuote | null> = ref(null)
  const quoteLoading = ref(false)
  const quoteError = ref(false)
  const attempt = ref(0)

  watch(
    [items, attempt],
    (_value, _oldValue, onCleanup) => {
      const current = items()
      if (current.length === 0) {
        quote.value = null
        quoteLoading.value = false
        quoteError.value = false
        return
      }
      quoteLoading.value = true
      quoteError.value = false
      const ctrl = new AbortController()
      const timer = window.setTimeout(() => {
        quoteCart(
          current
            .filter((i) => i.food)
            .map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
          ctrl.signal,
        )
          .then((next) => {
            quote.value = next
            quoteLoading.value = false
          })
          .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'ERR_CANCELED') return
            quote.value = null
            quoteLoading.value = false
            quoteError.value = true
          })
      }, QUOTE_DEBOUNCE_MS)
      onCleanup(() => {
        window.clearTimeout(timer)
        ctrl.abort()
      })
    },
    { deep: true, immediate: true },
  )

  /** Cho nút "Thử lại" gọi lại báo giá mà không cần đổi giỏ. */
  const retry = () => {
    attempt.value += 1
  }

  return {
    quote,
    quoteLoading,
    quoteError,
    get quoteStale() {
      return quoteLoading.value && quote.value !== null
    },
    retry,
  }
}
