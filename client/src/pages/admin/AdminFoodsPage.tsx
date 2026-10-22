import { useMemo, useState } from 'react'
import {
  Button, Checkbox, Form, Input, InputNumber, Modal, Select, Space, Table, message,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { adminDeleteFood, adminSaveFood, getCategories, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Food } from '../../types'
import { formatVND } from '../../utils/format'
import { apiErrorMessage } from '../../utils/api-error'
import UiImg from '../../components/UiImg'
import UiButton from '../../components/UiButton'
import UiIcon from '../../components/UiIcon'
import ImageField from '../../components/ImageField'
import { EmptyState, PageCard, PageHeader, StatusDot, TableSkeleton } from './shared'

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export default function AdminFoodsPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [search, setSearch] = useState('')
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())
  const [form] = Form.useForm()

  const { data, loading, refresh: refreshData } = useAsyncData((signal) => getFoods(undefined, signal), [])
  const { data: cats } = useAsyncData((signal) => getCategories(signal), [])
  const { run: saveFood, pending: saving } = useAsyncAction(
    (payload: Record<string, unknown>) => adminSaveFood(editing?.id ?? null, payload),
  )
  const { run: deleteFood } = useAsyncAction((id: number) => adminDeleteFood(id))

  const rows = useMemo(() => {
    const list = data ?? []
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (f) => f.name.toLowerCase().includes(kw) || (f.category?.name ?? '').toLowerCase().includes(kw),
    )
  }, [data, search])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ available: true, spicyLevel: 0, servingSize: 1 })
    setModal(true)
  }

  const openEdit = (f: Food) => {
    setEditing(f)
    form.setFieldsValue({ ...f, categoryId: f.category?.id })
    setModal(true)
  }

  const submit = async (v: Record<string, unknown>) => {
    const res = await saveFood({
      ...v,
      imageUrl: (v.imageUrl as string)?.trim() || '/images/hero.jpg',
      price: Number(v.price),
      spicyLevel: Number(v.spicyLevel),
      servingSize: Number(v.servingSize),
    })
    if (!res.ok) {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
      return
    }
    message.success(editing ? 'Đã cập nhật món ăn!' : 'Đã tạo món ăn!')
    setModal(false)
    void refreshData()
  }

  const remove = async (id: number) => {
    setBusyIds((prev) => new Set(prev).add(id))
    const res = await deleteFood(id)
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (res.ok) {
      message.success('Đã xóa món ăn')
      void refreshData()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Xóa thất bại')
    }
  }

  return (
    <div>
      <PageHeader
        title="Món ăn"
        extra={
          <UiButton kind="primary" onClick={openCreate}>
            Tạo món
          </UiButton>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc danh mục..."
          allowClear
          prefix={<UiIcon name="search" size={16} />}
          className="!w-72"
        />
        {(search.trim() || catFilter !== undefined || statusFilter !== 'all') && (
          <span className="text-sm text-stone-400">
            Hiển thị {rows.length} / {data?.length ?? 0} món
          </span>
        )}
      </div>

      <PageCard>
        <Table
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 800 }}
          locale={{
            emptyText: (
              <div className="flex flex-col items-center py-10 text-stone-400">
                <UiIcon name="inbox" size={32} className="mb-2 text-stone-300" />
                <p className="text-sm">Không có món ăn nào.</p>
              </div>
            ),
          }}
          columns={[
            {
              title: 'Món',
              render: (_, f) => (
                <div className="flex items-center gap-3">
                  <UiImg src={f.imageUrl} alt={f.name} imgClass="h-12 w-12 rounded-lg object-cover" />
                  <span className="font-medium text-stone-800">{f.name}</span>
                </div>
              ),
            }}
            columns={[
              {
                title: 'Món',
                render: (_, f) => (
                  <div className="flex items-center gap-3">
                    <UiImg src={f.imageUrl} alt={f.name} className="h-16 w-16 rounded-lg" />
                    <span className="font-medium text-stone-800">{f.name}</span>
                  </div>
                ),
              },
              {
                title: 'Danh mục',
                width: 140,
                render: (_, f) => (
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {f.category?.name ?? 'Không có'}
                  </span>
                ),
              },
              {
                title: 'Giá',
                width: 140,
                render: (_, f) => <span className="text-stone-600 tabular-nums">{formatVND(f.price)}</span>,
              },
              {
                title: 'Trạng thái',
                width: 130,
                render: (_, f) =>
                  f.available ? (
                    <StatusDot color="#10b981" label="Bán" />
                  ) : (
                    <StatusDot color="#ef4444" label="Ẩn" />
                  ),
              },
              {
                title: 'Thao tác',
                width: 170,
                render: (_, f) => (
                  <Space>
                    <Button size="small" onClick={() => openEdit(f)}>
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={busyIds.has(f.id)}
                      onClick={() =>
                        Modal.confirm({
                          title: 'Xóa món này?',
                          centered: true,
                          okText: 'Xóa',
                          okButtonProps: { danger: true },
                          cancelText: 'Hủy',
                          onOk: () => remove(f.id),
                        })
                      }
                    >
                      Xóa
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </PageCard>

      <Modal
        title={editing ? `Sửa món: ${editing.name}` : 'Tạo món mới'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okButtonProps={{ children: 'Lưu' }}
        cancelButtonProps={{ children: 'Hủy' }}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Tên món"
              rules={[{ required: true, message: 'Nhập tên' }]}
              className="md:col-span-2"
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="categoryId"
              label="Danh mục"
              rules={[{ required: true, message: 'Chọn danh mục' }]}
            >
              <Select options={(cats ?? []).map((c) => ({ label: c.name, value: c.id }))} />
            </Form.Item>
            <Form.Item name="price" label="Giá (đ)" rules={[{ required: true, message: 'Nhập giá' }]}>
              <InputNumber min={0} step={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="servingSize" label="Khẩu phần (người)">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="spicyLevel" label="Độ cay">
              <Select options={SPICY.map((s, i) => ({ label: s, value: i }))} />
            </Form.Item>
            <Form.Item name="description" label="Mô tả" className="md:col-span-2">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="ingredients" label="Nguyên liệu" className="md:col-span-2">
              <Input.TextArea rows={2} placeholder="Thịt, rau, gia vị..." />
            </Form.Item>
            <Form.Item name="dietaryTags" label="Chế độ ăn">
              <Input placeholder="Vegetarian, Gluten-Free..." />
            </Form.Item>
            <Form.Item name="allergens" label="Dị ứng">
              <Input placeholder="Gluten, Tôm..." />
            </Form.Item>
            <Form.Item name="imageUrl" label="Ảnh món ăn" className="md:col-span-2">
              <ImageField label="URL Ảnh" />
            </Form.Item>
            <Form.Item
              name="available"
              label={<span className="font-semibold text-emerald-700">Đang bán</span>}
              valuePropName="checked"
              className="md:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2"
              tooltip="Tắt để ẩn món khỏi thực đơn"
            >
              <Checkbox>Hiển thị trên thực đơn</Checkbox>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}