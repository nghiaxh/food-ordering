import { Drawer, Skeleton } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import useCartQuote from '../hooks/useCartQuote'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { formatVND } from '../utils/format'
import QuantityStepper from './QuantityStepper'
import UiButton from './UiButton'
import UiIcon from './UiIcon'
import UiImg from './UiImg'

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
      size="min(420px, 100vw)"
      destroyOnHidden
      title={
        <div className="flex items-baseline gap-2">
          <span>Giỏ hàng</span>
          {items.length > 0 && (
            <span className="text-xs font-normal text-stone-500">{items.length} món</span>
          )}
        </div>
      }
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
    >
      <CartDrawerContent onClose={close} />
    </Drawer>
  )
}

function CartDrawerContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const loaded = useCartStore((s) => s.loaded)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const { quote, quoteLoading, quoteError, quoteStale } = useCartQuote(items)

  const portions = items.reduce((n, i) => n + i.quantity, 0)

  if (!loaded) {
    return (
      <div className="p-5">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-300">
          <UiIcon name="shopping-cart" size={28} />
        </span>
        <p className="text-base font-semibold text-stone-900">Giỏ hàng đang trống</p>
        <p className="text-sm leading-relaxed text-stone-500">
          Chọn vài món từ thực đơn, hoặc hỏi trợ lý AI để được gợi ý theo khẩu vị.
        </p>
        <UiButton
          kind="primary"
          className="mt-2"
          onClick={() => {
            onClose()
            navigate('/')
          }}
        >
          Khám phá thực đơn
        </UiButton>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 divide-y divide-stone-100 overflow-y-auto px-4">
        {items.map((item) => {
          const food = item.food
          if (!food) return null
          const line = quote?.lines.find((l) => l.foodId === food.id)
          const unit = line?.unitPrice ?? food.price
          const lineTotal = line?.lineTotal ?? unit * item.quantity
          return (
            <div key={food.id} className="flex gap-3 py-4">
              <Link to={`/foods/${food.id}`} onClick={onClose} className="shrink-0">
                <UiImg src={food.imageUrl} alt={food.name} className="h-16 w-16 rounded-xl" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/foods/${food.id}`}
                  onClick={onClose}
                  className="block truncate text-sm font-semibold text-stone-900 hover:text-amber-700"
                >
                  {food.name}
                </Link>
                <p className="mt-0.5 text-xs text-stone-500">{formatVND(unit)} / phần</p>
                {line && line.lineDiscount > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-emerald-600">
                    {line.discountLabel ? `${line.discountLabel} · ` : ''}-{formatVND(line.lineDiscount)}
                  </p>
                )}
                {!food.available && (
                  <p className="mt-0.5 text-xs font-medium text-red-600">Món đã ngừng phục vụ</p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <QuantityStepper
                    value={item.quantity}
                    size="sm"
                    label={`Số lượng ${food.name}`}
                    onChange={(value) => void setQuantity(food.id, value)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-stone-900">
                      {formatVND(lineTotal)}
                    </span>
                    <UiButton
                      kind="icon"
                      size="small"
                      aria-label={`Xóa ${food.name}`}
                      icon={<UiIcon name="delete" size={14} />}
                      onClick={() => void remove(food.id)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="shrink-0 border-t border-stone-200 bg-white p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="space-y-1.5 text-sm">
          {quote ? (
            <>
              <div className="flex justify-between text-stone-600">
                <span>Tạm tính</span>
                <span className="tabular-nums">{formatVND(quote.subtotal)}</span>
              </div>
              {quote.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá</span>
                  <span className="tabular-nums">-{formatVND(quote.discountTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-base font-bold text-stone-900">
                <span>Tổng thanh toán</span>
                <span className="text-lg tabular-nums text-amber-700">{formatVND(quote.total)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">
              {quoteError ? 'Không tính được giá, thử lại sau.' : 'Đang cập nhật giá...'}
            </p>
          )}
          {/* Chỗ cố định để nhãn cập nhật hiện/ẩn không làm khối tiền nhảy chiều cao. */}
          <p className="h-4 text-xs text-stone-500" aria-live="polite">
            {quoteStale ? 'Đang cập nhật giá...' : ''}
          </p>
        </div>

        <UiButton
          kind="primary-lg"
          className="mt-1 w-full"
          disabled={quoteLoading || quoteError || !quote}
          onClick={() => {
            onClose()
            navigate('/checkout')
          }}
        >
          Tiến hành đặt món · {portions} phần
        </UiButton>
      </div>
    </div>
  )
}
