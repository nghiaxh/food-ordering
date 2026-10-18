import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, message } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteOrder, adminGetOrders, adminGetUsers, adminSaveOrder, adminUpdateOrderPayment, adminUpdateOrderStatus, getFoods, type AdminOrderPayload } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Order, OrderStatus } from '../../types'
import { formatVND } from '../../utils/format'
import { ORDER_STATUS_LABEL, allowedNextStatuses } from '../../utils/orders'
import { apiErrorMessage } from '../../utils/api-error'
import UiImg from '../../components/UiImg'
import { EmptyState, PageCard, PageHeader, StatusDot, TableSkeleton } from './shared'

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED']

const PAYMENT_METHODS = [
  { label: 'Tiền mặt khi nhận', value: 'CASH' },
  { label: 'Chuyển khoản', value: 'BANK_TRANSFER' },
  { label: 'Ví điện tử', value: 'E_WALLET' },
]

const STATUS_HEX: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PREPARING: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
}

export default function AdminOrdersPage() {
  const { data: orders, loading, error, refresh: refreshOrders } = useAsyncData(
    () => adminGetOrders(),
    [],
  )
  const { data: users } = useAsyncData(() => adminGetUsers(), [])
  const { data: foods } = useAsyncData(() => getFoods(undefined, undefined), [])
  const { run: updateStatus } = useAsyncAction(
    (payload: { id: number; status: OrderStatus }) => adminUpdateOrderStatus(payload.id, payload.status),
  )
  const { run: updatePayment } = useAsyncAction(
    (payload: { id: number; paid: boolean }) => adminUpdateOrderPayment(payload.id, payload.paid),
  )
  const { run: saveOrder, pending: saving } = useAsyncAction(
    (payload: { id: number | null; data: AdminOrderPayload }) => adminSaveOrder(payload.id, payload.data),
  )
  const { run: deleteOrder } = useAsyncAction((id: number) => adminDeleteOrder(id))
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [form] = Form.useForm()
  const detail = orders?.find((o) => o.id === detailId) ?? null

  useEffect(() => {
    if (error) message.error('Không tải được đơn hàng')
  }, [error])

  const stats = useMemo(() => {
    const list = orders ?? []
    const processing = list.filter(
      (o) => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING',
    ).length
    const completed = list.filter((o) => o.status === 'COMPLETED').length
    const revenue = list.reduce((sum, o) => (o.status === 'CANCELLED' ? sum : sum + Number(o.total)), 0)
    return { total: list.length, processing, completed, revenue }
  }, [orders])

  const rows = useMemo(() => {
    const list = orders ?? []
    if (statusFilter === 'ALL') return list
    return list.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const changeStatus = async (id: number, status: OrderStatus) => {
    setBusyIds((prev) => new Set(prev).add(id))
    const res = await updateStatus({ id, status })
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (res.ok) {
      message.success('Đã cập nhật trạng thái')
      void refreshOrders()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Cập nhật thất bại')
    }
  }

  const changePayment = async (id: number, paid: boolean) => {
    setBusyIds((prev) => new Set(prev).add(id))
    const res = await updatePayment({ id, paid })
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (res.ok) {
      message.success('Đã cập nhật trạng thái thanh toán')
      void refreshOrders()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Cập nhật thanh toán thất bại')
    }
  }

  const markBusy = (id: number, on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ items: [{ foodId: undefined, quantity: 1 }], paymentMethod: 'CASH', status: 'PENDING' })
    setModal(true)
  }

  const openEdit = (o: Order) => {
    setEditing(o)
    form.setFieldsValue({
      customerEmail: o.user?.email ?? '',
      receiverName: o.receiverName,
      phone: o.phone,
      address: o.address,
      paymentMethod: o.paymentMethod,
      note: o.note ?? '',
      status: o.status,
      paid: o.paymentStatus === 'PAID',
      items: o.items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    })
    setModal(true)
  }

  const submit = async (v: AdminOrderPayload) => {
    const res = await saveOrder({
      id: editing?.id ?? null,
      data: { ...v, note: v.note?.trim() || undefined },
    })
    if (!res.ok) {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
      return
    }
    message.success(editing ? 'Đã cập nhật đơn hàng' : 'Đã tạo đơn hàng')
    setModal(false)
    setEditing(null)
    void refreshOrders()
  }

  const remove = async (id: number) => {
    markBusy(id, true)
    const res = await deleteOrder(id)
    markBusy(id, false)
    if (res.ok) {
      message.success('Đã xóa đơn hàng')
      if (detailId === id) setDetailId(null)
      void refreshOrders()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Xóa thất bại')
    }
  }

  return (
    <div>
      <PageHeader
        title="Đơn hàng"
        subtitle={`Theo dõi ${stats.total} đơn đặt trong hệ thống.`}
        extra={
          <Button icon={<PlusOutlined />} onClick={openCreate}>
            Thêm đơn
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          className="w-full sm:w-56"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Tất cả trạng thái', value: 'ALL' },
            ...ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s })),
          ]}
        />
      </div>

      <PageCard>
        {loading && !orders ? (
          <TableSkeleton />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{
              emptyText: (
                <EmptyState
                  icon="inbox"
                  title="Không có đơn hàng nào."
                  hint="Điều chỉnh bộ lọc trạng thái."
                />
              ),
            }}
            columns={[
              {
                title: 'Mã đơn',
                width: 90,
                fixed: 'left',
                render: (_, o) => <span className="tabular-nums">#{o.id}</span>,
              },
              {
                title: 'Khách',
                width: 160,
                fixed: 'left',
                render: (_, o) => (
                  <div className="flex flex-col text-stone-700">
                    <span className="font-medium">{o.receiverName}</span>
                    <span className="text-xs tabular-nums text-stone-400">{o.phone}</span>
                  </div>
                ),
              },
              { title: 'Địa chỉ', render: (_, o) => <span className="text-stone-500">{o.address}</span> },
              {
                title: 'Món đặt',
                width: 100,
                render: (_, o) => (
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {o.items.length} món
                  </span>
                ),
              },
              {
                title: 'Tổng tiền',
                width: 140,
                render: (_, o) => <b className="tabular-nums">{formatVND(o.total)}</b>,
              },
              {
                title: 'Trạng thái',
                width: 180,
                render: (_, o) => (
                  <StatusDot color={STATUS_HEX[o.status]} label={ORDER_STATUS_LABEL[o.status] ?? o.status} />
                ),
              },
              {
                title: 'Thao tác',
                width: 240,
                render: (_, o) => (
                  <div className="flex items-center gap-2">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(o.id)}>
                      Chi tiết
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(o)}>
                      Sửa
                    </Button>
                    <Popconfirm title="Xóa đơn này?" okText="Xóa" onConfirm={() => remove(o.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} loading={busyIds.has(o.id)} />
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />
        )}
      </PageCard>

      <Drawer
        title={detail ? `Đơn #${detail.id}` : 'Chi tiết đơn'}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        size={480}
      >
        {detail ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <StatusDot
                color={STATUS_HEX[detail.status]}
                label={ORDER_STATUS_LABEL[detail.status] ?? detail.status}
              />
              {/* Chỉ hiện trạng thái kế tiếp hợp lệ: server cũng kiểm tra lại để không nhảy trạng thái. */}
              <Select
                size="small"
                value={detail.status}
                loading={busyIds.has(detail.id)}
                disabled={busyIds.has(detail.id) || allowedNextStatuses(detail.status).length === 0}
                onChange={(s) => changeStatus(detail.id, s)}
                style={{ width: 150 }}
                placeholder={allowedNextStatuses(detail.status).length === 0 ? 'Đã chốt đơn' : 'Cập nhật trạng thái'}
                options={allowedNextStatuses(detail.status).map((s) => ({
                  label: ORDER_STATUS_LABEL[s],
                  value: s,
                }))}
              />
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(detail)}>
                Sửa
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Thông tin đơn</p>
              <div className="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
                <p>
                  Đặt lúc:{' '}
                  <b className="font-medium text-stone-800">
                    {new Date(detail.createdAt).toLocaleString('vi-VN')}
                  </b>
                </p>
                <p>
                  Thanh toán: <b className="font-medium text-stone-800">{detail.paymentMethod}</b>
                </p>
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-sm text-stone-600">
                    Trạng thái:{' '}
                    <b className="font-medium text-stone-800">
                      {detail.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </b>
                  </span>
                  {detail.paymentStatus === 'PAID' ? (
                    <Button
                      size="small"
                      loading={busyIds.has(detail.id)}
                      disabled={busyIds.has(detail.id)}
                      onClick={() => changePayment(detail.id, false)}
                    >
                      Hoàn tác
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      loading={busyIds.has(detail.id)}
                      disabled={busyIds.has(detail.id)}
                      onClick={() => changePayment(detail.id, true)}
                    >
                      Đã thanh toán
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Người nhận</p>
              <div className="space-y-1.5 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
                <p>
                  <b className="font-medium text-stone-800">{detail.receiverName}</b>
                </p>
                <p className="tabular-nums">{detail.phone}</p>
                <p>{detail.address}</p>
                {detail.user?.email ? <p className="text-stone-400">{detail.user.email}</p> : null}
              </div>
            </div>

            {detail.note ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Lưu ý cho quán
                </p>
                <p className="rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">
                  {detail.note}
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Món đặt ({detail.items.length})
              </p>
              <div className="space-y-2.5">
                {detail.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-2.5">
                    <UiImg src={item.food.imageUrl} alt={item.food.name} className="h-12 w-12 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{item.food.name}</p>
                      <p className="text-xs text-stone-400">
                        {formatVND(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <b className="text-sm tabular-nums text-stone-800">{formatVND(item.price * item.quantity)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-sm text-stone-500">Tổng cộng</span>
              <b className="text-lg tabular-nums text-stone-900">{formatVND(detail.total)}</b>
            </div>
          </div>
        ) : (
          <EmptyState icon="inbox" title="Không tìm thấy đơn hàng." hint="Đơn có thể đã bị thay đổi." />
        )}
      </Drawer>

      <Modal
        title={editing ? `Sửa đơn #${editing.id}` : 'Thêm đơn hàng'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okButtonProps={{ children: 'Lưu' }}
        cancelButtonProps={{ children: 'Hủy' }}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
          <Form.Item
            name="customerEmail"
            label="Khách hàng"
            rules={[{ required: true, message: 'Chọn khách hàng' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách để gắn đơn"
              options={(users ?? [])
                .filter((u) => u.email)
                .map((u) => ({ label: `${u.fullName} (${u.email})`, value: u.email }))}
            />
          </Form.Item>

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="receiverName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Nhập số điện thoại' },
                { pattern: /^0\d{9}$/, message: 'Số điện thoại phải gồm đúng 10 chữ số' },
              ]}
            >
              <Input placeholder="0900000000" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Địa chỉ giao hàng" rules={[{ required: true, message: 'Nhập địa chỉ' }]}>
            <Input />
          </Form.Item>

          <div className="grid gap-x-3 sm:grid-cols-3">
            <Form.Item name="paymentMethod" label="Thanh toán" rules={[{ required: true }]}>
              <Select options={PAYMENT_METHODS} />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select options={ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABEL[s], value: s }))} />
            </Form.Item>
            <Form.Item name="paid" label="Thanh toán" valuePropName="checked">
              <Checkbox>Đã thanh toán</Checkbox>
            </Form.Item>
          </div>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Món đặt
                </p>
                {fields.map((field) => (
                  <div key={field.key} className="mb-2 flex items-start gap-2">
                    <Form.Item
                      {...field}
                      name={[field.name, 'foodId']}
                      className="mb-0 min-w-0 flex-1"
                      rules={[{ required: true, message: 'Chọn món' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Chọn món"
                        options={(foods ?? []).map((f) => ({
                          label: `${f.name} · ${formatVND(f.price)}${f.available ? '' : ' (tạm hết)'}`,
                          value: f.id,
                          disabled: !f.available,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'quantity']}
                      className="mb-0"
                      rules={[{ required: true, message: 'SL' }]}
                    >
                      <InputNumber min={1} max={99} style={{ width: 80 }} />
                    </Form.Item>
                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>
                  Thêm món
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item name="note" label="Lưu ý cho quán" className="mt-4" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={2} maxLength={255} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}