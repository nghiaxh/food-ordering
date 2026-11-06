import { useEffect, useState } from 'react'
import { Alert, Empty, Modal, QRCode, Skeleton, message } from 'antd'
import { QrcodeOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cancelOrder, getMyOrders, payOrder } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { canCancelOrder, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, orderCode } from '../utils/orders'
import { formatVND } from '../utils/format'
import type { Order, OrderStatus } from '../types'
import OrderTimeline from '../components/OrderTimeline'
import UiButton from '../components/UiButton'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'

const HOTLINE = '0292.888.9999'

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]

function isOrderStatus(value: string | null): value is OrderStatus {
  return value !== null && (STATUSES as string[]).includes(value)
}

/**
 * Danh sách đơn của khách. Bộ lọc trạng thái nằm trên URL (`?status=`) để mở lại hoặc
 * chia sẻ vẫn đúng tab. "Đặt lại" thêm món vào giỏ rồi mở drawer tại chỗ thay vì đẩy
 * khách sang trang giỏ cũ, giờ chỉ còn một trang `/checkout`.
 */
export default function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: orders, loading, error, refresh } = useAsyncData((signal) => getMyOrders(signal), [])
  const addToCart = useCartStore((s) => s.add)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [reorderingId, setReorderingId] = useState<number | null>(null)
  const [paying, setPaying] = useState<Order | null>(null)

  const statusParam = params.get('status')
  const filter: OrderStatus | 'ALL' = isOrderStatus(statusParam) ? statusParam : 'ALL'

  // Thông báo dẫn tới `/orders?orderId=...`: cuộn tới đúng đơn sau khi dữ liệu tải xong.
  const parsed = Number(params.get('orderId'))
  const highlightId = Number.isInteger(parsed) && parsed > 0 ? parsed : null

  useEffect(() => {
    if (loading || highlightId === null) return
    document.getElementById(`order-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [loading, highlightId])

  useEffect(() => {
    if (error) message.error('Không tải được danh sách đơn hàng')
  }, [error])

  const setFilter = (next: OrderStatus | 'ALL') => {
    const merged = new URLSearchParams(params)
    merged.delete('orderId')
    if (next === 'ALL') merged.delete('status')
    else merged.set('status', next)
    setParams(merged, { replace: true })
  }

  const reorder = async (order: Order) => {
    if (reorderingId !== null) return
    setReorderingId(order.id)
    const available = order.items.filter((i) => (i.food ? i.food.available : true))
    const skipped = order.items.filter((i) => i.food && !i.food.available).map((i) => i.food!.name)
    try {
      for (const item of available) {
        if (item.food) await addToCart(item.food, item.quantity)
      }
    } finally {
      setReorderingId(null)
    }
    if (available.length === 0) {
      message.warning('Các món trong đơn này đã ngừng phục vụ, không thể đặt lại')
      return
    }
    message.success(
      skipped.length > 0
        ? `Đã thêm vào giỏ (bỏ qua món ngừng phục vụ: ${skipped.join(', ')})`
        : 'Đã thêm toàn bộ món vào giỏ',
    )
    openDrawer('cart')
  }

  const cancel = async (order: Order) => {
    try {
      await cancelOrder(order.id)
      message.success(`Đã hủy đơn #${orderCode(order.id)}`)
      await refresh()
    } catch {
      message.error('Không hủy được đơn này')
      await refresh()
    }
  }

  const confirmPaid = async () => {
    if (!paying) return
    try {
      await payOrder(paying.id)
      message.success('Đã ghi nhận thanh toán')
      setPaying(null)
      await refresh()
    } catch {
      message.error('Không ghi nhận được thanh toán')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  const visible = orders?.filter((o) => filter === 'ALL' || o.status === filter) ?? []
  const counts = STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = orders?.filter((o) => o.status === status).length ?? 0
    return acc
  }, {})

  const tabClass = (active: boolean) =>
    `inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      active ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  return (
    <div className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Đơn hàng của tôi</h1>
          <p className="mt-1 text-sm text-stone-500">
            Theo dõi tiến trình và đặt lại món cũ bất cứ lúc nào.
          </p>
        </div>
        <a
          href={`tel:${HOTLINE.replace(/\./g, '')}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-amber-50 hover:text-amber-800"
        >
          <UiIcon name="phone" size={14} />
          {HOTLINE}
        </a>
      </div>

      {error ? (
        <Alert
          className="mt-5"
          type="error"
          showIcon
          message="Không tải được đơn hàng"
          description="Đã có lỗi khi kết nối máy chủ. Kiểm tra mạng rồi thử lại."
          action={
            <UiButton kind="default" onClick={() => void refresh()}>
              Thử lại
            </UiButton>
          }
        />
      ) : orders?.length === 0 ? (
        <Empty className="mt-16" description="Bạn chưa có đơn hàng nào">
          <UiButton kind="primary" onClick={() => navigate('/')}>
            Khám phá thực đơn ngay
          </UiButton>
        </Empty>
      ) : (
        <>
          <div
            className="-mx-3 mt-5 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Lọc theo trạng thái đơn"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'ALL'}
              className={tabClass(filter === 'ALL')}
              onClick={() => setFilter('ALL')}
            >
              Tất cả
              <span className="text-xs tabular-nums opacity-75">{orders?.length ?? 0}</span>
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={filter === status}
                className={tabClass(filter === status)}
                onClick={() => setFilter(status)}
              >
                {ORDER_STATUS_LABEL[status]}
                <span className="text-xs tabular-nums opacity-75">{counts[status]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <Empty className="mt-12" description="Không có đơn nào ở trạng thái này" />
          ) : (
            <div className="mt-4 space-y-4">
              {visible.map((o) => (
                <article
                  key={o.id}
                  id={`order-${o.id}`}
                  className={`scroll-mt-20 rounded-2xl bg-white p-4 ring-1 transition sm:p-5 ${
                    o.id === highlightId
                      ? 'ring-2 ring-amber-500'
                      : 'ring-stone-200/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900">Đơn #{orderCode(o.id)}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {new Date(o.createdAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        o.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <UiIcon name={o.paymentStatus === 'PAID' ? 'check-circle' : 'clock'} size={11} />
                      {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </span>
                  </div>

                  <OrderTimeline status={o.status} />

                  <div className="mt-3 space-y-2">
                    {o.items.map((it) => {
                      const gross = it.price * it.quantity
                      const discount = it.discountAmount ?? 0
                      return (
                        <div key={it.id} className="flex items-center gap-3">
                          {it.food?.imageUrl ? (
                            <UiImg
                              src={it.food.imageUrl}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg"
                            />
                          ) : (
                            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-300">
                              <UiIcon name="image" size={16} />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-800">
                              {it.food?.name ?? 'Món đã xóa'}
                            </p>
                            <p className="text-xs text-stone-500">
                              {it.quantity} × {formatVND(it.price)}
                            </p>
                          </div>
                          <span className="shrink-0 text-right text-sm tabular-nums">
                            {discount > 0 && (
                              <span className="mr-1.5 text-xs text-stone-400 line-through">
                                {formatVND(gross)}
                              </span>
                            )}
                            <span className={discount > 0 ? 'font-semibold text-emerald-700' : 'text-stone-800'}>
                              {formatVND(gross - discount)}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {!!o.discountTotal && o.discountTotal > 0 && (
                    <div className="mt-2 flex items-center justify-between text-sm text-emerald-700">
                      <span>Giảm giá</span>
                      <span className="tabular-nums">-{formatVND(o.discountTotal)}</span>
                    </div>
                  )}

                  {o.note && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
                      <span className="font-semibold">Lưu ý cho quán:</span> {o.note}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-3 text-sm">
                    <span className="text-stone-500">
                      {PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}
                    </span>
                    <span className="text-base font-bold tabular-nums text-amber-800">
                      {formatVND(o.total)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Chỉ hiện ở đơn COMPLETED; đơn đang đi mà đặt lại sẽ trộn đồ cũ vào giỏ gây nhầm lẫn. */}
                    {o.status === 'COMPLETED' && (
                      <UiButton
                        kind="default"
                        onClick={() => void reorder(o)}
                        loading={reorderingId === o.id}
                      >
                        Đặt lại
                      </UiButton>
                    )}
                    {o.status === 'PENDING' && o.paymentStatus !== 'PAID' && (
                      <UiButton
                        kind="default"
                        icon={<QrcodeOutlined />}
                        onClick={() => setPaying(o)}
                      >
                        Thanh toán
                      </UiButton>
                    )}
                    {canCancelOrder(o) && (
                      <UiButton
                        kind="danger"
                        onClick={() =>
                          Modal.confirm({
                            title: 'Hủy đơn này?',
                            content:
                              'Bạn chỉ có thể tự hủy đơn khi đơn chưa thanh toán và còn chờ xác nhận.',
                            centered: true,
                            okText: 'Hủy đơn',
                            okButtonProps: { danger: true },
                            cancelText: 'Giữ đơn',
                            onOk: () => cancel(o),
                          })
                        }
                      >
                        Hủy đơn
                      </UiButton>
                    )}
                    {o.status === 'PENDING' && o.paymentStatus === 'PAID' && (
                      <span className="text-xs italic text-stone-500">
                        Đã thanh toán. Gọi {HOTLINE} nếu cần hủy hoặc hoàn tiền.
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-8 text-sm text-stone-500">
        Cần hỗ trợ đơn hàng? Gọi hotline {HOTLINE} hoặc hỏi trợ lý AI ở góc màn hình.
      </p>

      <Modal
        open={paying !== null}
        onCancel={() => setPaying(null)}
        title={`Thanh toán đơn #${orderCode(paying?.id ?? 0)}`}
        footer={[
          <UiButton key="back" kind="default" onClick={() => setPaying(null)}>
            Quay lại
          </UiButton>,
          <UiButton key="pay" kind="primary-lg" onClick={() => void confirmPaid()}>
            Xác nhận đã thanh toán
          </UiButton>,
        ]}
      >
        {paying && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="text-sm text-stone-500">
              Phương thức: {PAYMENT_METHOD_LABEL[paying.paymentMethod] ?? paying.paymentMethod}
            </div>
            {/* Chỉ phương thức QR mới có mã để quét; COD trả tiền khi nhận món nên không hiện QR.
                Mã hoá mã đơn để quét ra thông tin nhận dạng đơn, không phải payload chuyển khoản. */}
            {paying.paymentMethod === 'QR' && (
              <QRCode value={`FOOD-${paying.id}-${paying.total}`} size={168} errorLevel="M" />
            )}
            <div className="text-lg font-bold text-stone-900">{formatVND(paying.total)}</div>
            <Alert
              type="warning"
              showIcon
              message="Thanh toán mô phỏng"
              description={
                paying.paymentMethod === 'QR'
                  ? 'Mã QR trên chỉ chứa mã đơn, không phải mã chuyển khoản nên không chuyển tiền thật. Bấm nút xác nhận để hệ thống ghi nhận trạng thái đơn.'
                  : 'Bạn trả tiền mặt khi nhận món. Bấm nút xác nhận để hệ thống ghi nhận trạng thái đơn.'
              }
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
