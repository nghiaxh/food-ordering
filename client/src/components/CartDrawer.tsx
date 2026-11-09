import { useCallback, useMemo, useRef } from 'react'
import { Drawer, Skeleton, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import useCartQuote from '../hooks/useCartQuote'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { formatVND } from '../utils/format'
import { discountText } from '../utils/food-tags'
import type { Food } from '../types'
import QuantityStepper from './QuantityStepper'
import UiButton from './UiButton'
import UiIcon from './UiIcon'
import UiImg from './UiImg'

/** Chỉ gợi ý nhóm dễ ghép thêm vào bữa, không đẩy món chính trùng với giỏ. */
const RELATED_CATEGORIES = ['Đồ uống', 'Tráng miệng']

/**
 * Giỏ hàng dạng drawer bên phải. Không đổi URL nên khách xem lại thực đơn ngay khi đóng,
 * và mọi thao tác sửa số lượng đều diễn ra ở đây thay vì trên trang checkout.
 * Nội dung chỉ mount khi mở để không gọi báo giá ở mọi trang.
 */
export default function CartDrawer() {
  const open = useUiStore((s) => s.activeDrawer === 'cart')
  const close = useUiStore((s) => s.closeDrawer)
  const items = useCartStore((s) => s.items)

  return (
    <Drawer
      open={open}
      onClose={close}
      placement="right"
      size="min(480px, 100vw)"
      destroyOnHidden
      title={
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-stone-900">Giỏ hàng</span>
          {items.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
              {items.length}
            </span>
          )}
        </span>
      }
      styles={{
        body: { padding: 0, overflow: 'hidden' },
        header: { paddingBottom: 12, borderBottom: '1px solid #e7e5e4' },
      }}
    >
      <CartDrawerContent onClose={close} />
    </Drawer>
  )
}

function CartDrawerContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const loaded = useCartStore((s) => s.loaded)
  const add = useCartStore((s) => s.add)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const { quote, quoteLoading, quoteError, quoteStale, retry } = useCartQuote(items)

  // Món gợi ý lấy một lần khi mở drawer; lọc lại theo giỏ hiện tại để vừa thêm xong là biến mất.
  const related = useAsyncData((signal) => getFoods(undefined, signal), [])
  const suggestions = useMemo(() => {
    const inCart = new Set(items.map((i) => i.food?.id))
    return (related.data ?? [])
      .filter(
        (f) =>
          f.available &&
          !inCart.has(f.id) &&
          f.category !== null &&
          RELATED_CATEGORIES.includes(f.category.name),
      )
      .sort((a, b) => (a.discountedPrice ?? a.price) - (b.discountedPrice ?? b.price))
      .slice(0, 3)
  }, [related.data, items])

  const hideToast = useRef<(() => void) | null>(null)

  /**
   * Xoá thẳng không hỏi lại, nhưng để đường lùi trong 5 giây: khách bấm nhầm vẫn lấy lại
   * được đúng món và đúng số phần, không phải mở thực đơn tìm lại.
   */
  const removeLine = useCallback(
    (food: Food, quantity: number) => {
      void remove(food.id)
      hideToast.current?.()
      const hide = message.open({
        type: 'success',
        duration: 5,
        content: (
          <span className="flex items-center gap-3">
            <span className="min-w-0 truncate">Đã xóa {food.name}</span>
            <button
              type="button"
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
              onClick={() => {
                hide()
                void add(food, quantity)
              }}
            >
              Hoàn tác
            </button>
          </span>
        ),
      })
      hideToast.current = hide
    },
    [add, remove],
  )

  if (!loaded) {
    return (
      <div className="p-5">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-stone-100 text-stone-300">
          <UiIcon name="shopping-cart" size={24} />
        </span>
        <p className="text-base font-semibold text-stone-900">Giỏ hàng đang trống</p>
        <p className="text-sm leading-relaxed text-stone-500">
          Chọn vài món từ thực đơn, hoặc hỏi trợ lý AI để được gợi ý.
        </p>
        <UiButton
          kind="primary"
          className="mt-2"
          onClick={() => {
            onClose()
            navigate('/')
          }}
        >
          Xem thực đơn
        </UiButton>
      </div>
    )
  }

  const discountTotal = quote?.discountTotal ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {items.map((item) => {
          const food = item.food
          if (!food) return null
          const line = quote?.lines.find((l) => l.foodId === food.id)
          // Server trả `unitPrice` là giá gốc; giá sau giảm của một phần là thành tiền dòng
          // chia cho số lượng của CHÍNH dòng báo giá. Chia cho số lượng mới sẽ ra giá sai
          // tạm thời khi đổi số lượng, chia cho số lượng cũ thì đúng và không chớp.
          const originalUnit = line?.unitPrice ?? food.price
          const discountedUnit = line
            ? line.lineTotal / line.quantity
            : (food.discountedPrice ?? food.price)
          const lineTotal = line?.lineTotal ?? discountedUnit * item.quantity
          const lineDiscount = line?.lineDiscount ?? 0
          const hasDiscount = discountedUnit < originalUnit

          return (
            <div
              key={food.id}
              data-testid="cart-line"
              className="flex gap-3 border-b border-stone-100 py-3.5 last:border-0"
            >
              <Link to={`/foods/${food.id}`} onClick={onClose} className="shrink-0 self-start">
                <UiImg src={food.imageUrl} alt={food.name} className="h-16 w-16 rounded-xl" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/foods/${food.id}`}
                  onClick={onClose}
                  className="line-clamp-2 block text-sm font-semibold leading-snug text-stone-900 hover:text-amber-700"
                >
                  {food.name}
                </Link>
                {/* Chỉ nói "/phần" khi khách đã tăng số lượng, một phần thì đơn giá đã rõ.
                    Có giảm thì hiện giá gốc gạch ngang trước giá sau giảm để đối chiếu. */}
                <p className="mt-0.5 text-xs" aria-label={hasDiscount ? `Giá gốc ${formatVND(originalUnit)}, giảm còn ${formatVND(discountedUnit)}${item.quantity > 1 ? ' mỗi phần' : ''}` : undefined}>
                  {hasDiscount && (
                    <span className="mr-1 text-stone-400 line-through">{formatVND(originalUnit)}</span>
                  )}
                  <span className="font-medium text-stone-800">{formatVND(discountedUnit)}</span>
                  {item.quantity > 1 && <span className="text-stone-500"> / phần</span>}
                </p>
                {lineDiscount > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {discountText(line?.discountLabel) ?? 'Ưu đãi'}
                    <span className="tabular-nums">-{formatVND(lineDiscount)}</span>
                  </span>
                )}
                {!food.available && (
                  <p className="mt-0.5 text-xs font-medium text-red-600">Món đã ngừng phục vụ</p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <QuantityStepper
                      value={item.quantity}
                      size="sm"
                      disabled={!food.available}
                      label={`Số lượng ${food.name}`}
                      onChange={(value) => void setQuantity(food.id, value)}
                    />
                    <button
                      type="button"
                      aria-label={`Xóa ${food.name}`}
                      className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-red-600"
                      onClick={() => removeLine(food, item.quantity)}
                    >
                      Xóa
                    </button>
                  </div>
                  <span
                    data-testid="cart-line-total"
                    className="shrink-0 text-sm font-semibold tabular-nums text-stone-900"
                  >
                    {formatVND(lineTotal)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {suggestions.length > 0 && (
          <div className="mt-1 border-t border-stone-100 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Thêm cho bữa này
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {suggestions.map((food) => (
                <div key={food.id} className="min-w-0">
                  <div className="relative">
                    <Link to={`/foods/${food.id}`} onClick={onClose} className="block">
                      <UiImg
                        src={food.imageUrl}
                        alt={food.name}
                        className="aspect-square w-full rounded-lg"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Thêm ${food.name} vào giỏ`}
                      className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-amber-700 text-white shadow-sm ring-2 ring-white transition hover:bg-amber-800"
                      onClick={() => void add(food, 1)}
                    >
                      <UiIcon name="plus" size={13} />
                    </button>
                  </div>
                  <Link
                    to={`/foods/${food.id}`}
                    onClick={onClose}
                    className="mt-1.5 line-clamp-2 block text-[11px] leading-snug text-stone-700 hover:text-amber-800"
                  >
                    {food.name}
                  </Link>
                  <p className="text-[11px] font-semibold tabular-nums text-stone-900">
                    {formatVND(food.discountedPrice ?? food.price)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-200 bg-white">
        <div className="bg-stone-50/70 px-4 py-2.5">
          {quote ? (
            <>
              {/* Không có giảm giá thì tạm tính trùng tổng, in hai lần chỉ làm rối. */}
              {discountTotal > 0 && (
                <>
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Tạm tính</span>
                    <span className="tabular-nums">{formatVND(quote.subtotal)}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-sm text-emerald-600">
                    <span>Giảm giá</span>
                    <span className="tabular-nums">-{formatVND(discountTotal)}</span>
                  </div>
                </>
              )}
              <div className="mt-1 flex items-baseline justify-between border-t border-stone-200 pt-1.5">
                <span className="text-sm font-semibold text-stone-900">Tổng thanh toán</span>
                <span
                  data-testid="cart-total"
                  className={`text-lg font-bold tabular-nums text-amber-800 transition-opacity ${
                    quoteStale ? 'opacity-60' : ''
                  }`}
                >
                  {formatVND(quote.total)}
                </span>
              </div>
            </>
          ) : quoteError ? (
            <div className="flex min-h-14 items-center justify-between gap-2 text-sm text-stone-600">
              <span>Không tính được giá.</span>
              <button
                type="button"
                className="cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                onClick={retry}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <p className="flex min-h-14 items-center text-sm text-stone-500">Đang cập nhật giá…</p>
          )}
        </div>

        <div
          className="px-4 pt-2"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <UiButton
            kind="primary-lg"
            className="w-full"
            disabled={!quote || quoteLoading || quoteError}
            onClick={() => {
              onClose()
              navigate('/checkout')
            }}
          >
            Đặt món
          </UiButton>
          {/* Nhãn cập nhật giá và lối quay lại thực đơn dùng chung một hàng cho đỡ cao. */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="min-h-4 min-w-0 truncate text-xs text-stone-500" aria-live="polite">
              {quoteStale || !quote
                ? 'Đang cập nhật giá…'
                : discountTotal > 0
                  ? 'Đã áp khuyến mãi tốt nhất cho từng món'
                  : ''}
            </span>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-1 py-1 text-xs font-medium text-stone-500 transition hover:text-stone-800"
              onClick={onClose}
            >
              Chọn thêm món
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
