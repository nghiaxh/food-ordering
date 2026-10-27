import { useEffect, useState } from 'react'
import { Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { adminDeletePromotion, adminGetPromotions, adminSavePromotion } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Promotion } from '../../types'
import { formatVND } from '../../utils/format'
import UiButton from '../../components/UiButton'
import { EmptyState, PageCard, PageHeader, TableSkeleton } from './shared'

const SCOPES: { value: Promotion['scope']; label: string }[] = [
  { value: 'GLOBAL', label: 'Toàn thực đơn' },
  { value: 'CATEGORY', label: 'Theo danh mục' },
  { value: 'FOOD', label: 'Theo món' },
  { value: 'COMBO', label: 'Theo combo' },
]

const TYPES: { value: Promotion['discountType']; label: string }[] = [
  { value: 'PERCENT', label: 'Phần trăm' },
  { value: 'FIXED', label: 'Số tiền cố định' },
]

interface PromotionFormValues {
  name: string
  description?: string
  discountType: Promotion['discountType']
  discountValue: number
  maxDiscount?: number | null
  minOrderTotal?: number | null
  scope: Promotion['scope']
  targetIds?: string
  code?: string
  startsAt: Dayjs
  endsAt: Dayjs
  daysOfWeek?: string
  active: boolean
  priority: number
  stackable: boolean
  usageLimit?: number | null
  randomCount?: number
  claimable?: boolean
  occasion?: string
}

function discountLabel(p: Promotion): string {
  if (p.discountType === 'PERCENT') {
    return `${p.discountValue}%${p.maxDiscount ? ` (tối đa ${formatVND(p.maxDiscount)})` : ''}`
  }
  return formatVND(p.discountValue)
}

export default function AdminPromotionsPage() {
  const { data: promotions, loading, refresh } = useAsyncData(() => adminGetPromotions(), [])
  const { run: save, pending: saving } = useAsyncAction(
    (payload: { id: number | null; data: Record<string, unknown> }) => adminSavePromotion(payload.id, payload.data),
  )
  const { run: remove } = useAsyncAction((id: number) => adminDeletePromotion(id))
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form] = Form.useForm<PromotionFormValues>()
  const claimable = Form.useWatch('claimable', form)

  useEffect(() => {
    if (!promotions && !loading) void refresh()
  }, [promotions, loading, refresh])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      active: true,
      discountType: 'PERCENT',
      scope: 'GLOBAL',
      priority: 0,
      stackable: false,
      randomCount: 0,
      claimable: false,
    })
    setModal(true)
  }

  const openEdit = (p: Promotion) => {
    setEditing(p)
    form.setFieldsValue({
      name: p.name,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxDiscount: p.maxDiscount,
      minOrderTotal: p.minOrderTotal,
      scope: p.scope,
      targetIds: p.targetIds?.join(', '),
      code: p.code ?? undefined,
      startsAt: dayjs(p.startsAt),
      endsAt: dayjs(p.endsAt),
      daysOfWeek: p.daysOfWeek ?? undefined,
      active: p.active,
      priority: p.priority,
      stackable: p.stackable,
      usageLimit: p.usageLimit,
      randomCount: p.randomCount ?? 0,
      claimable: p.claimable ?? false,
      occasion: p.occasion ?? undefined,
    })
    setModal(true)
  }

  const submit = async (values: PromotionFormValues) => {
    const data: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description,
      discountType: values.discountType,
      discountValue: values.discountValue,
      maxDiscount: values.maxDiscount ?? null,
      minOrderTotal: values.minOrderTotal ?? null,
      scope: values.scope,
      targetIds: (values.targetIds ?? '')
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
      code: values.code?.trim() || null,
      startsAt: values.startsAt.format('YYYY-MM-DDTHH:mm:ss'),
      endsAt: values.endsAt.format('YYYY-MM-DDTHH:mm:ss'),
      daysOfWeek: values.daysOfWeek?.trim() || null,
      active: values.active,
      priority: values.priority,
      stackable: values.stackable,
      usageLimit: values.usageLimit ?? null,
      randomCount: values.randomCount ?? 0,
      claimable: values.claimable ?? false,
      occasion: values.occasion?.trim() || null,
    }
    const res = await save({ id: editing?.id ?? null, data })
    if (!res.ok) {
      message.error('Lưu khuyến mãi thất bại')
      return
    }
    message.success('Đã lưu khuyến mãi')
    setModal(false)
    setEditing(null)
    void refresh()
  }

  return (
    <div>
      <PageHeader
        title="Khuyến mãi"
        subtitle="Chương trình không có mã tự áp vào từng dòng; chương trình có mã dùng ở bước thanh toán."
        extra={
          <UiButton kind="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm khuyến mãi
          </UiButton>
        }
      />
      <PageCard>
        {loading && !promotions ? (
          <TableSkeleton />
        ) : (
          <Table
            rowKey="id"
            dataSource={promotions ?? []}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
            locale={{ emptyText: <EmptyState icon="tag" title="Chưa có khuyến mãi nào." /> }}
            columns={[
              { title: 'Tên', dataIndex: 'name' },
              {
                title: 'Mức giảm',
                render: (_, p: Promotion) => discountLabel(p),
              },
              {
                title: 'Phạm vi',
                dataIndex: 'scope',
                render: (v: Promotion['scope']) => SCOPES.find((s) => s.value === v)?.label ?? v,
              },
              { title: 'Mã', dataIndex: 'code', render: (v: string | null) => v || 'Tự động' },
              {
                title: 'Cách nhận',
                render: (_, p: Promotion) =>
                  p.claimable ? 'Khách nhận vào ví' : p.code ? 'Nhập mã' : 'Tự động',
              },
              {
                title: 'Hiệu lực',
                render: (_, p: Promotion) =>
                  `${new Date(p.startsAt).toLocaleDateString('vi-VN')} – ${new Date(p.endsAt).toLocaleDateString('vi-VN')}`,
              },
              {
                title: 'Trạng thái',
                dataIndex: 'active',
                render: (v: boolean) => (v ? 'Đang chạy' : 'Tạm dừng'),
              },
              {
                title: 'Thao tác',
                render: (_, p: Promotion) => (
                  <div className="flex gap-2">
                    <UiButton
                      kind="icon"
                      aria-label={`Sửa ${p.name}`}
                      icon={<EditOutlined />}
                      onClick={() => openEdit(p)}
                    />
                    <UiButton
                      kind="icon"
                      danger
                      aria-label={`Xóa ${p.name}`}
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        Modal.confirm({
                          title: `Xóa khuyến mãi "${p.name}"?`,
                          okText: 'Xóa',
                          okButtonProps: { danger: true },
                          cancelText: 'Giữ lại',
                          centered: true,
                          onOk: async () => {
                            const res = await remove(p.id)
                            if (!res.ok) {
                              message.error('Không xóa được khuyến mãi này')
                              return
                            }
                            message.success('Đã xóa khuyến mãi')
                            void refresh()
                          },
                        })
                      }
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </PageCard>

      <Modal
        title={editing ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          <Form.Item name="name" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên chương trình' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả hiển thị cho khách">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="discountType" label="Kiểu giảm" rules={[{ required: true }]}>
              <Select options={TYPES} />
            </Form.Item>
            <Form.Item name="discountValue" label="Giá trị" rules={[{ required: true, message: 'Nhập giá trị giảm' }]}>
              <InputNumber<number> min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="maxDiscount" label="Giảm tối đa (theo %)">
              <InputNumber<number> min={0} className="w-full" placeholder="Bỏ trống nếu không giới hạn" />
            </Form.Item>
            <Form.Item name="minOrderTotal" label="Đơn tối thiểu">
              <InputNumber<number> min={0} step={1000} className="w-full" />
            </Form.Item>
          </div>

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="scope" label="Phạm vi" rules={[{ required: true }]}>
              <Select options={SCOPES} />
            </Form.Item>
            <Form.Item
              name="targetIds"
              label="ID mục tiêu"
              extra="Chỉ dùng cho phạm vi danh mục, món hoặc combo; phân tách bằng dấu phẩy."
            >
              <Input placeholder="Ví dụ: 1, 3" />
            </Form.Item>
          </div>

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item
              name="code"
              label="Mã giảm giá"
              extra="Bỏ trống nếu chương trình tự động áp cho mọi đơn phù hợp."
            >
              <Input placeholder="WELCOME" />
            </Form.Item>
            <Form.Item name="occasion" label="Nhãn dịp" extra="Hiện trên thẻ ưu đãi, ví dụ Khách mới, Dịp lễ.">
              <Input placeholder="Khách mới" />
            </Form.Item>
          </div>

          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="startsAt" label="Bắt đầu" rules={[{ required: true, message: 'Chọn thời điểm bắt đầu' }]}>
              <DatePicker showTime className="w-full" />
            </Form.Item>
            <Form.Item name="endsAt" label="Kết thúc" rules={[{ required: true, message: 'Chọn thời điểm kết thúc' }]}>
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </div>

          <Form.Item
            name="daysOfWeek"
            label="Ngày trong tuần"
            extra="Ví dụ SAT,SUN. Bỏ trống nghĩa là mọi ngày."
          >
            <Input placeholder="SAT,SUN" />
          </Form.Item>

          <div className="grid gap-x-3 sm:grid-cols-3">
            <Form.Item name="priority" label="Ưu tiên">
              <InputNumber<number> className="w-full" />
            </Form.Item>
            <Form.Item name="usageLimit" label="Giới hạn lượt dùng">
              <InputNumber<number> min={0} className="w-full" placeholder="Không giới hạn" />
            </Form.Item>
            <Form.Item
              name="randomCount"
              label="Số món ngẫu nhiên mỗi ngày"
              extra="0 nghĩa là áp cho mọi món khớp phạm vi."
            >
              <InputNumber<number> min={0} className="w-full" />
            </Form.Item>
          </div>

          <div className="grid gap-x-3 sm:grid-cols-3">
            <Form.Item name="active" label="Đang chạy" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="stackable" label="Cộng dồn" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              name="claimable"
              label="Cho khách nhận vào ví"
              valuePropName="checked"
              extra={claimable ? 'Cần có mã giảm giá để khách áp được.' : undefined}
            >
              <Checkbox />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
