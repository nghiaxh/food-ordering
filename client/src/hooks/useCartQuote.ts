import { useCallback, useEffect, useState } from 'react'
import { quoteCart } from '../api/api'
import type { CartItem, CartQuote } from '../types'

/** Bấm số lượng liên tục thì chỉ gửi báo giá một lần, tránh mỗi lần bấm một request. */
const QUOTE_DEBOUNCE_MS = 250

/**
 * Báo giá giỏ do server tính, dùng chung cho drawer giỏ và trang checkout.
 *
 * Gửi đúng danh sách dòng đang hiển thị thay vì để server đọc lại giỏ DB (request cũ có
 * thể về sau và ghi đè giỏ mới). Abort request cũ để response muộn không thắng. Giữ số cũ
 * trong lúc tính lại để khối tổng tiền không nháy sang "Đang cập nhật giá..." mỗi lần bấm.
 */
export default function useCartQuote(items: CartItem[]) {
  const [quote, setQuote] = useState<CartQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null)
      setQuoteLoading(false)
      setQuoteError(false)
      return
    }
    const ctrl = new AbortController()
    setQuoteLoading(true)
    setQuoteError(false)
    const timer = window.setTimeout(() => {
      quoteCart(
        items.filter((i) => i.food).map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
        ctrl.signal,
      )
        .then((next) => {
          if (ctrl.signal.aborted) return
          setQuote(next)
          setQuoteLoading(false)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setQuote(null)
          setQuoteLoading(false)
          setQuoteError(true)
        })
    }, QUOTE_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [items, attempt])

  /** Cho nút "Thử lại" gọi lại báo giá mà không cần đổi giỏ. */
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    quote,
    quoteLoading,
    quoteError,
    quoteStale: quoteLoading && quote !== null,
    retry,
  }
}
