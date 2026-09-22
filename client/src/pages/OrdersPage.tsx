import { useEffect } from 'react'
import { Alert, Button, Divider, Empty, Skeleton, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, InboxOutlined } from '@ant-design/icons'
import { getMyOrders } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../utils/orders'
import { formatVND } from '../utils/format'

export default function OrdersPage() {
  const { data: orders, loading, error, refresh } = useAsyncData((signal) => getMyOrders(signal), [])

  useEffect(() => {
    if (error) message.error('Không tải được danh sách đơn hàng')
  }, [error])

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
        <div className="mt-6 space-y-4">
          {orders?.map((o) => (
            <div key={o.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-stone-900">Đơn #RH-{String(o.id).padStart(4, '0')}</div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <CheckCircleOutlined /> {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                  <Tag color={ORDER_STATUS_COLOR[o.status] ?? 'default'}>
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </Tag>
                </div>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div className="space-y-1.5">
                {o.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">
                      {it.quantity}x {it.food.name}
                    </span>
                    <span className="text-stone-500">{formatVND(it.price)}</span>
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