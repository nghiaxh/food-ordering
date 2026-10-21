import { useEffect } from 'react'
import { Alert, Button, Divider, Empty, Skeleton, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, InboxOutlined } from '@ant-design/icons'
import { getMyOrders } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import { ORDER_FLOW, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, orderCode } from '../utils/orders'
import { formatVND } from '../utils/format'

export default function OrdersPage() {
  const { data: orders, loading, error, refresh } = useAsyncData((signal) => getMyOrders(signal), [])

  useEffect(() => {
    if (error) message.error('Không tải được danh sách đơn hàng')
  }, [error])

  const reorder = async (order: Order) => {
    if (reorderingId !== null) return
    setReorderingId(order.id)
    const available = order.items.filter((i) => i.food.available)
    const skipped = order.items.filter((i) => !i.food.available).map((i) => i.food.name)
    try {
      for (const item of available) {
        await addToCart(item.food, item.quantity)
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
                      {o.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-sm">
                          <span className="text-stone-600">
                            {it.quantity}x {it.food.name}
                          </span>
                          <span className="text-stone-500">{formatVND(it.price)}</span>
                        </div>
                      ))}
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
                      {o.status === 'PENDING' && (
                        <Popconfirm
                          title="Hủy đơn này?"
                          description="Chỉ hủy được khi đơn còn chờ xác nhận."
                          okText="Hủy đơn"
                          cancelText="Giữ đơn"
                          onConfirm={() => void cancel(o)}
                        >
                          <UiButton kind="danger">Hủy đơn</UiButton>
                        </Popconfirm>
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