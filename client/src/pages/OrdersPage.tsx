import { useEffect, useState } from 'react'
import { Alert, Empty, Modal, QRCode, Select, Skeleton, Steps, Tag, message } from 'antd'
import { QrcodeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { cancelOrder, getMyOrders, payOrder } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../utils/orders'
import { formatVND } from '../utils/format'

export default function OrdersPage() {
  const { data: orders, loading, error, refresh } = useAsyncData((signal) => getMyOrders(signal), [])
  const addToCart = useCartStore((s) => s.add)
  const [reorderingId, setReorderingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [paying, setPaying] = useState<Order | null>(null)

  useEffect(() => {
    if (error) message.error('Không tải được danh sách đơn hàng')
  }, [error])

  const reorder = async (order: Order) => {
    if (reorderingId !== null) return
    setReorderingId(order.id)
    const available = order.items.filter((i) => i.food ? i.food.available : true)
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
    navigate('/cart')
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
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton active />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {error ? (
        <div className="mt-6">
          <Alert
            type="error"
            showIcon
            message="Không tải được đơn hàng"
            description="Đã có lỗi khi kết nối máy chủ. Kiểm tra mạng rồi thử lại."
          />
          <Button className="mt-3" onClick={() => void refresh()}>Thử lại</Button>
        </div>
      ) : orders?.length === 0 ? (
        <Empty description="Bạn chưa có đơn hàng nào">
          <Typography.Link href="/foods">Khám phá thực đơn ngay!</Typography.Link>
        </Empty>
      ) : (
        <>
          <Select
            className="w-full sm:w-64"
            value={filter}
            onChange={setFilter}
            aria-label="Lọc theo trạng thái"
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              ...Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />

          {visible.length === 0 ? (
            <Empty className="mt-10" description="Không có đơn nào ở trạng thái này" />
          ) : (
            <div className="mt-4 space-y-4">
              {visible.map((o) => {
                const step = ORDER_FLOW.indexOf(o.status)
                return (
                  <div key={o.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-stone-900">
                        Đơn #{orderCode(o.id)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400">
                          {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        <Tag color={o.paymentStatus === 'PAID' ? 'green' : 'orange'}>
                          {o.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </Tag>
                      </div>
                    </div>

                    {o.status === 'CANCELLED' ? (
                      <p className="mt-3 text-sm text-stone-500">Đơn này đã được hủy.</p>
                    ) : (
                      <Steps
                        className="mt-4"
                        size="small"
                        current={step}
                        status={o.status === 'COMPLETED' ? 'finish' : 'process'}
                        items={ORDER_FLOW.map((s) => ({ title: ORDER_STATUS_LABEL[s] }))}
                      />
                    )}

                    <div className="mt-4 space-y-1.5">
                      {o.items.map((it) => {
                        const gross = it.price * it.quantity
                        const discount = it.discountAmount ?? 0
                        return (
                          <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-stone-600">
                              {it.quantity}x {it.food?.name}
                            </span>
                            <span className="shrink-0 text-right text-stone-500">
                              {discount > 0 && (
                                <span className="mr-2 text-xs text-stone-400 line-through">{formatVND(gross)}</span>
                              )}
                              <span className={discount > 0 ? 'font-medium text-emerald-700' : undefined}>
                                {formatVND(gross - discount)}
                              </span>
                            </span>
                          </div>
                        )
                      })}
                      {!!o.discountTotal && o.discountTotal > 0 && (
                        <div className="flex items-center justify-between text-sm text-emerald-700">
                          <span>Giảm giá</span>
                          <span className="tabular-nums">-{formatVND(o.discountTotal)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-sm">
                        <span className="text-stone-500">
                          {PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}
                        </span>
                        <b className="text-base text-amber-700">{formatVND(o.total)}</b>
                      </div>
                      {o.note && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
                          <span className="font-semibold">Lưu ý cho quán:</span> {o.note}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <UiButton kind="default" onClick={() => void reorder(o)} loading={reorderingId === o.id}>
                        Đặt lại
                      </UiButton>
                      {o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED' && (
                        <UiButton kind="default" icon={<QrcodeOutlined />} onClick={() => setPaying(o)}>
                          Thanh toán
                        </UiButton>
                      )}
                      {o.status === 'PENDING' && o.paymentStatus !== 'PAID' && (
                        <UiButton
                          kind="danger"
                          onClick={() =>
                            Modal.confirm({
                              title: 'Hủy đơn này?',
                              content: 'Bạn chỉ có thể tự hủy đơn khi đơn chưa thanh toán và còn chờ xác nhận.',
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
                        <span className="self-center text-xs text-stone-500 italic">
                          Đơn đã thanh toán, vui lòng gọi hotline 0246.888.9999 để hủy/hoàn tiền.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-sm">
                  <span className="text-stone-500">{o.paymentMethod}</span>
                  <b className="text-base text-amber-700">{formatVND(o.total)}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-8 flex items-center gap-2 text-sm text-stone-400">
        <InboxOutlined /> Bạn cần hỗ trợ đơn hàng? Hãy gọi hotline hoặc hỏi chatbot của chúng tôi.
      </p>
    </div>
  )
}