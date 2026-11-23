import { ref, watch, type Ref } from 'vue'
import { quoteCart } from '@/user/cart/api'
import type { CartItem, CartQuote } from '@/shared/types'

const QUOTE_DEBOUNCE_MS = 250

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

  /** Cho nut "Thu lai" goi lai bao gia ma khong can doi gio. */
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
