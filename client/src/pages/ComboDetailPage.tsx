import { useState } from 'react'
import { Drawer, message } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { getCombo } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import UiButton from '../components/UiButton'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'

/**
 * Chi tiết combo dạng panel phủ, cùng khung với chi tiết món để khách không phải học hai
 * cách xem khác nhau. Combo không có đánh giá riêng: đánh giá gắn với từng món, không gắn
 * với gói bán kèm.
 */
export default function ComboDetailPage() {
  const { id } = useParams()
  const comboId = Number(id)
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  // Giữ Drawer mounted đến khi animation đóng xong mới rời route, ngược lại mở thì hiệu ứng
  // trượt vào tự chạy.
  const [open, setOpen] = useState(true)
  const addCombo = useCartStore((s) => s.addCombo)

  const close = () => setOpen(false)

  const {
    data: combo,
    loading,
    error,
    refresh,
  } = useAsyncData((signal) => getCombo(comboId, signal), [comboId])

  const price = combo ? (combo.discountedPrice ?? combo.price) : 0
  const unavailable = !combo?.available
  const loosePrice = (combo?.items ?? []).reduce(
    (sum, item) => sum + Number(item.food.price) * item.quantity,
    0,
  )
  const saving = combo ? loosePrice - Number(price) : 0

  const addToCart = () => {
    if (!combo) return
    void addCombo(combo, qty)
    message.success(`Đã thêm ${qty} ${combo.name} vào giỏ`)
    close()
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      afterOpenChange={(visible) => {
        if (!visible) navigate('/')
      }}
      width={720}
      title={combo ? combo.name : 'Chi tiết combo'}
      styles={{ body: { paddingTop: 16 } }}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200/70" />
          <div className="h-8 w-2/3 animate-pulse rounded-xl bg-stone-200/70" />
          <div className="h-5 w-1/3 animate-pulse rounded-xl bg-stone-200/70" />
        </div>
      ) : error || !combo ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
          <UiIcon name="exclamation-circle" size={28} className="text-stone-300" />
          <p className="mt-3 font-medium text-stone-900">Không tải được combo</p>
          <p className="mt-1 text-sm text-stone-500">Vui lòng thử lại.</p>
          <UiButton kind="default" className="mt-5" onClick={() => void refresh()}>
            Thử lại
          </UiButton>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-stone-100">
            <UiImg
              src={combo.imageUrl}
              alt={combo.name}
              preview
              className="aspect-[4/3] w-full sm:aspect-[2/1]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {!!combo.discountPercent && (
                <div className="text-sm font-semibold text-amber-700">-{combo.discountPercent}%</div>
              )}
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-amber-700">{formatVND(price)}</span>
                {Number(price) < Number(combo.price) && (
                  <span className="text-base tabular-nums text-stone-400 line-through">
                    {formatVND(combo.price)}
                  </span>
                )}
              </div>
            </div>
            {unavailable && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">Hết combo</span>
            )}
          </div>

          {combo.description && <p className="mt-4 leading-relaxed text-stone-600">{combo.description}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-x-6 border-t border-stone-100">
            <div className="border-b border-stone-100 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Số món</dt>
              <dd className="mt-0.5 text-sm font-medium text-stone-800">{combo.items.length} món</dd>
            </div>
            <div className="border-b border-stone-100 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Giá gọi riêng
              </dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-stone-800">{formatVND(loosePrice)}</dd>
            </div>
            {saving > 0 && (
              <div className="col-span-2 border-b border-stone-100 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Tiết kiệm
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                  {formatVND(saving)} so với gọi lẻ
                </dd>
              </div>
            )}
          </dl>

          <h3 className="mt-5 text-sm font-semibold text-stone-900">Món trong combo</h3>
          <ul className="mt-2 divide-y divide-stone-100 rounded-2xl ring-1 ring-stone-200/70">
            {combo.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-2.5">
                <UiImg
                  src={item.food.imageUrl}
                  alt={item.food.name}
                  className="h-14 w-14 shrink-0 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-900">{item.food.name}</div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    x{item.quantity} · {formatVND(item.food.price)}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-700">
                  {formatVND(Number(item.food.price) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Cùng một hàng số lượng + tổng tiền + thêm vào giỏ như chi tiết món. */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex shrink-0 items-center overflow-hidden rounded-xl ring-1 ring-stone-200">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed"
              >
                <MinusOutlined />
              </button>
              <span className="w-10 text-center text-base font-semibold tabular-nums text-stone-900">{qty}</span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={unavailable}
                onClick={() => setQty((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed"
              >
                <PlusOutlined />
              </button>
            </div>
            <p className="min-w-0 flex-1 text-sm font-semibold tabular-nums text-stone-700">
              {formatVND(Number(price) * qty)}
            </p>
            <UiButton kind="primary-lg" disabled={unavailable} onClick={addToCart} className="shrink-0">
              {unavailable ? 'Hết combo' : 'Thêm vào giỏ'}
            </UiButton>
          </div>
        </>
      )}
    </Drawer>
  )
}
