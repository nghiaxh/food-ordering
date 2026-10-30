import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, Table } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteCombo, adminGetCombos, adminSaveCombo, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Combo } from '../../types'
import { formatVND } from '../../utils/format'
import UiButton from '../../components/UiButton'
import FormModal from '../../components/FormModal'
import { EmptyState, PageCard, PageHeader, TableSkeleton, confirmRemove, runAndMessage } from './shared'

interface ComboFormValues {
  name: string
  description?: string
  imageUrl?: string
  price: number
  available: boolean
  items: { foodId: number; quantity: number }[]
}

export default function AdminCombosPage() {
  const { data: combos, loading, refresh } = useAsyncData(() => adminGetCombos(), [])
  const { data: foods } = useAsyncData(() => getFoods(), [])
  const { run: save, pending: saving } = useAsyncAction(
    (payload: { id: number | null; data: ComboFormValues }) => adminSaveCombo(payload.id, payload.data),
  )
  const { run: remove } = useAsyncAction((id: number) => adminDeleteCombo(id))
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Combo | null>(null)
  const [form] = Form.useForm<ComboFormValues>()

  useEffect(() => {
    if (!combos && !loading) void refresh()
  }, [combos, loading, refresh])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ available: true, items: [{ foodId: 0, quantity: 1 }] })
    setModal(true)
  }

  const openEdit = (combo: Combo) => {
    setEditing(combo)
    form.setFieldsValue({
      name: combo.name,
      description: combo.description,
      imageUrl: combo.imageUrl,
      price: combo.price,
      available: combo.available,
      items: combo.items.map((i) => ({ foodId: i.food.id, quantity: i.quantity })),
    })
    setModal(true)
  }

  const submit = async (values: ComboFormValues) => {
    const res = await save({
      id: editing?.id ?? null,
      data: {
        name: values.name.trim(),
        description: values.description,
        imageUrl: values.imageUrl,
        price: values.price,
        available: values.available,
        items: values.items,
      },
    })
    await runAndMessage(res, {
      success: 'Đã lưu combo',
      fallback: 'Lưu combo thất bại',
      onSuccess: () => {
        setModal(false)
        setEditing(null)
        void refresh()
      },
    })
  }

  // Xóa combo trong onOk để modal đợi promise xong mới đóng, giữ đúng hành vi cũ.
  const doRemove = async (combo: Combo) => {
    const res = await remove(combo.id)
    await runAndMessage(res, {
      success: 'Đã xóa combo',
      fallback: 'Không xóa được combo này',
      onSuccess: () => void refresh(),
    })
  }

  return (
    <div>
      <PageHeader
        title="Combo"
        subtitle="Gói nhiều món bán kèm với giá thấp hơn tổng giá lẻ."
        extra={
          <UiButton kind="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm combo
          </UiButton>
        }
      />
      <PageCard>
        {loading && !combos ? (
          <TableSkeleton />
        ) : (
          <Table
            rowKey="id"
            dataSource={combos ?? []}
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <EmptyState icon="tag" title="Chưa có combo nào." /> }}
            columns={[
              { title: 'Tên', dataIndex: 'name' },
              { title: 'Món trong combo', render: (_, c: Combo) => `${c.items.length} món` },
              { title: 'Giá', dataIndex: 'price', render: (v: number) => formatVND(v) },
              { title: 'Trạng thái', dataIndex: 'available', render: (v: boolean) => (v ? 'Đang bán' : 'Tạm ẩn') },
              {
                title: 'Thao tác',
                render: (_, c: Combo) => (
                  <div className="flex gap-2">
                    <UiButton kind="icon" aria-label={`Sửa ${c.name}`} icon={<EditOutlined />} onClick={() => openEdit(c)} />
                    <UiButton
                      kind="icon"
                      danger
                      aria-label={`Xóa ${c.name}`}
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        confirmRemove({
                          title: `Xóa combo "${c.name}"?`,
                          content: 'Combo đã nằm trong đơn hàng cũ sẽ không xóa được.',
                          cancelText: 'Giữ lại',
                          onOk: () => doRemove(c),
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

      <FormModal
        title={editing ? 'Sửa combo' : 'Thêm combo'}
        open={modal}
        onClose={() => setModal(false)}
        onSubmit={() => form.submit()}
        saving={saving}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          <Form.Item name="name" label="Tên combo" rules={[{ required: true, message: 'Nhập tên combo' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="imageUrl" label="Ảnh (URL hoặc đường dẫn nội bộ)">
            <Input placeholder="/images/foods/pho-bo.webp" />
          </Form.Item>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="price" label="Giá combo" rules={[{ required: true, message: 'Nhập giá combo' }]}>
              <InputNumber<number>
                min={0}
                step={1000}
                className="w-full"
                formatter={(v) => `${v ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number((v ?? '').replace(/\./g, ''))}
              />
            </Form.Item>
            <Form.Item name="available" label="Đang bán" valuePropName="checked">
              <input type="checkbox" className="mt-2 h-4 w-4 accent-amber-600" />
            </Form.Item>
          </div>

          <Form.List
            name="items"
            rules={[
              {
                validator: async (_, items: ComboFormValues['items']) => {
                  if (!items || items.length === 0) throw new Error('Combo phải có ít nhất một món')
                },
              },
            ]}
          >
            {(fields, { add, remove: removeField }, { errors }) => (
              <>
                <div className="mb-1 text-sm text-stone-700">Món trong combo</div>
                {fields.map((field) => (
                  <div key={field.key} className="mb-2 flex items-start gap-2">
                    <Form.Item
                      name={[field.name, 'foodId']}
                      className="mb-0 min-w-0 flex-1"
                      rules={[{ required: true, message: 'Chọn món' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        placeholder="Chọn món"
                        options={(foods ?? []).map((f) => ({ label: `${f.name} · ${formatVND(f.price)}`, value: f.id }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'quantity']}
                      className="mb-0"
                      rules={[{ required: true, message: 'SL' }]}
                    >
                      <InputNumber min={1} max={99} className="w-20" aria-label="Số lượng" />
                    </Form.Item>
                    <UiButton
                      kind="icon"
                      danger
                      aria-label="Bỏ món khỏi combo"
                      icon={<DeleteOutlined />}
                      onClick={() => removeField(field.name)}
                    />
                  </div>
                ))}
                <Form.ErrorList errors={errors} />
                <UiButton kind="default" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>
                  Thêm món
                </UiButton>
              </>
            )}
          </Form.List>
        </Form>
      </FormModal>
    </div>
  )
}
