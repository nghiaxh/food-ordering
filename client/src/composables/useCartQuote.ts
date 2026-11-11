import { ref, watch, type Ref } from 'vue'
import { quoteCart } from '@/modules/cart/api'
import type { CartItem, CartQuote } from '@/shared/types'

/** Bam so luong lien tuc thi chi gui bao gia mot lan, tranh moi lan bam mot request. */
const QUOTE_DEBOUNCE_MS = 250

/**
 * Bao gia gio do server tinh, dung chung cho drawer gio va trang checkout.
 *
 * Gui dung danh sach dong dang hien thi thay vi de server doc lai gio DB (request cu co
 * the ve sau va ghi de gio moi). Abort request cu de response muon khong thang. Giu so cu
 * trong luc tinh lai de khoi tong tien khong nhay sang "Dang cap nhat gia..." moi lan bam.
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
