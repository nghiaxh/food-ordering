import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Drawer, Form, Input, InputNumber, Modal, Segmented, Select, Table, message } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { adminDeleteOrder, adminGetOrders, adminGetUsers, adminSaveOrder, adminUpdateOrderPayment, adminUpdateOrderStatus, getFoods, type AdminOrderPayload } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Order, OrderStatus } from '../../types'
import { formatVND } from '../../utils/format'
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, allowedNextStatuses, orderCode } from '../../utils/orders'
import { apiErrorMessage } from '../../utils/api-error'
import UiImg from '../../components/UiImg'
import UiButton from '../../components/UiButton'
import { EmptyState, PageCard, PageHeader, StatusDot, TableSkeleton } from './shared'

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED']

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
    form.setFieldsValue({ items: [{ foodId: undefined, quantity: 1 }], paymentMethod: 'COD', status: 'PENDING' })
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
      items: o.items.map((i) => i.food ? { foodId: i.food.id, quantity: i.quantity } : { comboId: i.combo!.id, quantity: i.quantity }),
    })
    setModal(true)
  }

  // Đơn đã giao hoặc đã hủy thì khoá hoàn toàn; đơn đã thu tiền hoặc đã xác nhận chỉ sửa
  // được thông tin giao hàng, không đổi món. Server kiểm lại đúng luật này.
  const finalState = (o: Order) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  const itemsLocked =
    !!editing && !(editing.status === 'PENDING' && editing.paymentStatus === 'UNPAID')

  const submit = async (v: AdminOrderPayload) => {
    // Khi đơn đã qua bước đặt món, không gửi danh sách món lên để server không hiểu là
    // đang thay món (server chặn thao tác đó sau khi đơn đã xác nhận hoặc đã thu tiền).
    const { items, ...rest } = v
    const data = { ...rest, note: v.note?.trim() || undefined, ...(itemsLocked ? {} : { items }) }
    const res = await saveOrder({
      id: editing?.id ?? null,
      data,
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
        extra={
          <UiButton kind="primary" onClick={openCreate}>
            Thêm đơn
          </UiButton>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as OrderStatus | 'ALL')}
          options={[
            {
              label: (
                <span className="flex items-center gap-1 px-1 py-0.5">
                  Tất cả ({orders?.length ?? 0})
                </span>
              ),
              value: 'ALL',
            },
            ...ORDER_STATUSES.map((s) => {
              const count = (orders ?? []).filter((o) => o.status === s).length
              return {
                label: (
                  <span className="flex items-center gap-1 px-1 py-0.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_HEX[s] }} />
                    {ORDER_STATUS_LABEL[s]} {count > 0 ? `(${count})` : ""}
                  </span>
                ),
                value: s,
              }
            }),
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
            scroll={{ x: 1200 }}
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
                render: (_, o) => <span className="tabular-nums">#{orderCode(o.id)}</span>,
              },
              {
                title: 'Khách',
                width: 160,
                fixed: 'left',
                render: (_, o) => (
                  <div className="flex flex-col text-stone-700">
                    <span className="block truncate font-medium" title={o.receiverName}>
                      {o.receiverName}
                    </span>
                    <span className="text-xs tabular-nums text-stone-400">{o.phone}</span>
                  </div>
                ),
              },
              { title: 'Địa chỉ', width: 200, render: (_, o) => <span className="text-stone-500">{o.address}</span> },
              {
                title: 'Món đặt',
                width: 110,
                 onCell: () => ({ style: { verticalAlign: 'top' } }),
                render: (_, o) => (
                  <span className="whitespace-nowrap rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {o.items.reduce((sum, i) => sum + i.quantity, 0)} món
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
                title: 'Thao tác nhanh',
                width: 320,
                render: (_, o) => {
                  const nexts = allowedNextStatuses(o.status)
                  const primaryNext = nexts.find((s) => s !== 'CANCELLED')
                  return (
                    <div className="flex items-center gap-1.5">
                      {primaryNext && (
                        <Button
                          size="small"
                          type="primary"
                          className="!h-7 !bg-amber-600 text-xs font-medium"
                          loading={busyIds.has(o.id)}
                          onClick={() => void changeStatus(o.id, primaryNext)}
                        >
                          {primaryNext === 'CONFIRMED' && 'Duyệt đơn'}
                          {primaryNext === 'PREPARING' && 'Bắt đầu nấu'}
                          {primaryNext === 'COMPLETED' && 'Hoàn thành'}
                        </Button>
                      )}
                      <Button size="small" className="!h-7 text-xs" icon={<EyeOutlined />} onClick={() => setDetailId(o.id)}>
                        Chi tiết
                      </Button>
                      <Button
                        size="small"
                        className="!h-7 text-xs"
                        icon={<EditOutlined />}
                        disabled={finalState(o)}
                        title={finalState(o) ? 'Đơn đã chốt nên không sửa được' : undefined}
                        onClick={() => openEdit(o)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={busyIds.has(o.id)}
                        onClick={() =>
                          Modal.confirm({
                            title: 'Xóa đơn này?',
                            centered: true,
                            okText: 'Xóa',
                            okButtonProps: { danger: true },
                            cancelText: 'Hủy',
                            onOk: () => remove(o.id),
                          })
                        }
                      />
                    </div>
                  )
                },
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
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={finalState(detail)}
                title={finalState(detail) ? 'Đơn đã chốt nên không sửa được' : undefined}
                onClick={() => openEdit(detail)}
              >
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
                  Thanh toán:{' '}
                  <b className="font-medium text-stone-800">
                    {PAYMENT_METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod}
                  </b>
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
                    <UiImg src={item.food?.imageUrl ?? item.combo?.imageUrl ?? ''} alt={item.food?.name ?? item.combo?.name ?? ''} className="h-12 w-12 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{item.food?.name ?? item.combo?.name}</p>
                      <p className="text-xs text-stone-400">
                        {formatVND(item.price)} × {item.quantity}
                        {!!item.discountAmount && (
                          <span className="ml-1 text-emerald-600">· giảm {formatVND(item.discountAmount)}</span>
                        )}
                      </p>
                    </div>
                    <b className="text-sm tabular-nums text-stone-800">
                      {formatVND(item.price * item.quantity - (item.discountAmount ?? 0))}
                    </b>
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
                {itemsLocked && (
                  <p className="mb-2 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
                    Đơn đã xác nhận hoặc đã thu tiền nên chỉ sửa được người nhận, số điện thoại,
                    địa chỉ và ghi chú. Muốn đổi món, hãy hủy đơn và tạo đơn mới.
                  </p>
                )}
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
                        disabled={itemsLocked}
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
                      <InputNumber min={1} max={99} disabled={itemsLocked} style={{ width: 80 }} />
                    </Form.Item>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      disabled={itemsLocked}
                      aria-label="Bỏ món khỏi đơn"
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
                <Button type="dashed" block disabled={itemsLocked} onClick={() => add({ quantity: 1 })}>
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