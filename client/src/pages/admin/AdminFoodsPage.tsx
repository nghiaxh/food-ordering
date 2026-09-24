import { useMemo, useState } from 'react'
import {
  Button, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, message,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteFood, adminSaveFood, getCategories, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Food } from '../../types'
import { formatVND } from '../../utils/format'
import { apiErrorMessage } from '../../utils/api-error'
import UiImg from '../../components/UiImg'
import UiIcon from '../../components/UiIcon'
import { EmptyState, PageCard, PageHeader, StatCard, StatusDot, TableSkeleton } from './shared'

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export default function AdminFoodsPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'hidden'>('all')
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set())
  const [form] = Form.useForm()
  const liveImage = Form.useWatch('imageUrl', form)

  const { data, loading, refresh: refreshData } = useAsyncData((signal) => getFoods(undefined, signal), [])
  const { data: cats } = useAsyncData((signal) => getCategories(signal), [])
  const { run: saveFood, pending: saving } = useAsyncAction(
    (payload: Record<string, unknown>) => adminSaveFood(editing?.id ?? null, payload),
  )
  const { run: deleteFood } = useAsyncAction((id: number) => adminDeleteFood(id))

  const stats = useMemo(() => {
    const list = data ?? []
    const available = list.filter((f) => f.available).length
    const avg = list.length ? Math.round(list.reduce((sum, f) => sum + Number(f.price), 0) / list.length) : 0
    return { total: list.length, available, hidden: list.length - available, avg }
  }, [data])

  const rows = useMemo(() => {
    const list = data ?? []
    const kw = search.trim().toLowerCase()
    return list.filter((f) => {
      if (kw && !f.name.toLowerCase().includes(kw) && !(f.category?.name ?? '').toLowerCase().includes(kw)) {
        return false
      }
      if (catFilter !== undefined && f.category?.id !== catFilter) return false
      if (statusFilter === 'available' && !f.available) return false
      if (statusFilter === 'hidden' && f.available) return false
      return true
    })
  }, [data, search, catFilter, statusFilter])

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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Món ăn"
        subtitle={`Quản lý ${stats.total} món trong thực đơn.`}
        extra={
          <Button icon={<PlusOutlined />} onClick={openCreate}>
            Tạo món
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng món" value={stats.total} tone="stone" icon="tag" />
        <StatCard label="Đang bán" value={stats.available} tone="green" icon="check-circle" />
        <StatCard label="Đã ẩn" value={stats.hidden} tone="red" icon="eye-slash" />
        <StatCard label="Giá trung bình" value={formatVND(stats.avg)} tone="amber" icon="star-fill" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc danh mục..."
          allowClear
          prefix={<UiIcon name="search" size={16} />}
          className="w-full sm:w-72"
        />
        <Select
          allowClear
          placeholder="Tất cả danh mục"
          style={{ width: 200 }}
          value={catFilter}
          onChange={setCatFilter}
          options={(cats ?? []).map((c) => ({ label: c.name, value: c.id }))}
        />
        <Select
          style={{ width: 170 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Tất cả trạng thái', value: 'all' },
            { label: 'Đang bán', value: 'available' },
            { label: 'Đã ẩn', value: 'hidden' },
          ]}
        />
      </div>

      <PageCard>
        {loading && !data ? (
          <TableSkeleton />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <EmptyState
                  icon="inbox"
                  title="Không có món ăn nào."
                  hint="Điều chỉnh bộ lọc hoặc tạo món mới."
                />
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
              { title: 'Độ cay', width: 110, render: (_, f) => SPICY[f.spicyLevel] ?? 'Không có' },
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
                    <Popconfirm title="Xóa món này?" onConfirm={() => remove(f.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} loading={busyIds.has(f.id)}>
                        Xóa
                      </Button>
                    </Popconfirm>
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
            <Form.Item name="price" label="Giá" rules={[{ required: true, message: 'Nhập giá' }]}>
              <InputNumber min={0} step={1000} addonAfter="đ" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="servingSize" label="Khẩu phần (người)">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="spicyLevel" label="Độ cay">
              <Select options={SPICY.map((s, i) => ({ label: s, value: i }))} />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="ingredients" label="Nguyên liệu">
              <Input.TextArea rows={2} placeholder="Thịt, rau, gia vị..." />
            </Form.Item>
            <Form.Item name="dietaryTags" label="Chế độ ăn">
              <Input placeholder="Vegetarian, Gluten-Free..." />
            </Form.Item>
            <Form.Item name="allergens" label="Dị ứng">
              <Input placeholder="Gluten, Tôm..." />
            </Form.Item>
            <Form.Item name="imageUrl" label="URL Ảnh" className="md:col-span-2">
              <Input placeholder="Bỏ trống để dùng ảnh mặc định" />
            </Form.Item>
            {liveImage ? (
              <div className="md:col-span-2">
                <p className="mb-1.5 text-xs font-medium text-stone-400">Xem trước</p>
                <UiImg
                  src={liveImage}
                  alt="Xem trước ảnh món"
                  imgClass="h-28 w-72 rounded-xl border border-stone-100 object-cover"
                />
              </div>
            ) : null}
            <Form.Item name="available" label="Đang bán" valuePropName="checked" className="md:col-span-2">
              <Checkbox>Hiển thị trên thực đơn</Checkbox>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}