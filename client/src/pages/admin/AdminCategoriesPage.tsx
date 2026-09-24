import { useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Tooltip, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteCategory, adminSaveCategory, getCategories, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Category } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import { slugify } from '../../utils/slug'
import UiImg from '../../components/UiImg'
import UiIcon from '../../components/UiIcon'
import { EmptyState, PageHeader, StatCard } from './shared'

export default function AdminCategoriesPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const imageUrl = Form.useWatch('imageUrl', form)
  const nameValue = Form.useWatch('name', form)

  const { data, loading, refresh: refreshData } = useAsyncData((signal) => getCategories(signal), [])
  const { data: foods } = useAsyncData((signal) => getFoods(undefined, signal), [])
  const { run: saveCategory, pending: saving } = useAsyncAction(
    (payload: { id: number | null; name: string; slug: string; imageUrl: string }) =>
      adminSaveCategory(payload.id, { name: payload.name, slug: payload.slug, imageUrl: payload.imageUrl }),
  )
  const { run: deleteCategory } = useAsyncAction((id: number) => adminDeleteCategory(id))

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const f of foods ?? []) {
      if (f.category) map.set(f.category.id, (map.get(f.category.id) ?? 0) + 1)
    }
    return map
  }, [foods])

  const stats = useMemo(() => {
    const list = data ?? []
    const withFoods = list.filter((c) => (counts.get(c.id) ?? 0) > 0).length
    return { total: list.length, withFoods, empty: list.length - withFoods }
  }, [data, counts])

  const rows = useMemo(() => {
    const list = data ?? []
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((c) => c.name.toLowerCase().includes(kw) || c.slug.toLowerCase().includes(kw))
  }, [data, search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModal(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    form.setFieldsValue({ name: c.name, imageUrl: c.imageUrl ?? '' })
    setModal(true)
  }

  const submit = async (v: { name?: string; imageUrl?: string }) => {
    const trimmed = v.name?.trim() ?? ''
    if (!trimmed) {
      message.warning('Nhập tên danh mục')
      return
    }
    const res = await saveCategory({
      id: editing?.id ?? null,
      name: trimmed,
      slug: editing?.slug?.trim() ? editing.slug : slugify(trimmed),
      imageUrl: v.imageUrl?.trim() || editing?.imageUrl || '',
    })
    if (!res.ok) {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
      return
    }
    message.success('Đã lưu danh mục')
    setModal(false)
    setEditing(null)
    void refreshData()
  }

  const remove = async (id: number) => {
    setBusyId(id)
    const res = await deleteCategory(id)
    setBusyId(null)
    if (res.ok) {
      message.success('Đã xóa')
      void refreshData()
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Xóa thất bại')
    }
  }

  const slugPreview = editing?.slug ?? slugify(nameValue?.trim() ?? '')

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Danh mục"
        subtitle={`Xếp thực đơn thành ${data?.length ?? 0} nhóm.`}
        extra={
          <Button icon={<PlusOutlined />} onClick={openCreate}>
            Tạo danh mục
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Tổng danh mục" value={stats.total} />
        <StatCard label="Có món ăn" value={stats.withFoods} />
        <StatCard label="Trống" value={stats.empty} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc slug..."
          allowClear
          prefix={<UiIcon name="search" size={16} />}
          className="w-full sm:w-72"
        />
        {search.trim() ? (
          <span className="text-sm text-stone-400">
            Hiển thị {rows.length} / {data?.length ?? 0} danh mục
          </span>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <div className="aspect-[4/3] bg-stone-100" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-1/2 rounded-full bg-stone-100" />
                <div className="h-3 w-1/3 rounded-full bg-stone-100" />
                <div className="flex gap-2 pt-1">
                  <div className="h-8 flex-1 rounded-lg bg-stone-100" />
                  <div className="h-8 w-16 rounded-lg bg-stone-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((c) => {
            const count = counts.get(c.id) ?? 0
            return (
              <div
                key={c.id}
                className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70 transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <UiImg
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-full w-full transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-stone-900/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {count} món
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold text-stone-800" title={c.name}>
                    {c.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-stone-400">/{c.slug}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c)} className="flex-1">
                      Sửa
                    </Button>
                    <Tooltip title={count > 0 ? `Còn ${count} món, không thể xóa` : undefined}>
                      <Popconfirm
                        title="Xóa danh mục này?"
                        okText="Xóa"
                        onConfirm={() => remove(c.id)}
                        disabled={count > 0}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={busyId === c.id}
                          disabled={count > 0}
                        >
                          Xóa
                        </Button>
                      </Popconfirm>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
          <EmptyState
            icon="th-large"
            title={data?.length ? 'Không tìm thấy danh mục nào.' : 'Chưa có danh mục nào.'}
            hint={
              data?.length
                ? 'Điều chỉnh từ khóa tìm kiếm.'
                : 'Tạo danh mục đầu tiên để tổ chức thực đơn.'
            }
            action={
              data?.length ? undefined : (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Tạo danh mục
                </Button>
              )
            }
          />
        </div>
      )}

      <Modal
        title={editing ? `Sửa: ${editing.name}` : 'Tạo danh mục'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okButtonProps={{ children: 'Lưu' }}
        cancelButtonProps={{ children: 'Hủy' }}
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[{ required: true, message: 'Nhập tên danh mục' }]}
          >
            <Input placeholder="Món Việt" onPressEnter={() => form.submit()} />
          </Form.Item>
          <p className="-mt-2 mb-5 text-xs text-stone-400">
            Slug tự động: <span className="font-medium text-stone-500">/{slugPreview}</span>
          </p>
          <Form.Item name="imageUrl" label="URL Ảnh">
            <Input placeholder="https://..." allowClear />
          </Form.Item>
          <div>
            <p className="mb-1.5 text-xs font-medium text-stone-400">Xem trước</p>
            {imageUrl ? (
              <UiImg
                src={imageUrl}
                alt="Xem trước ảnh danh mục"
                className="aspect-[4/3] w-full max-w-sm rounded-xl border border-stone-100"
              />
            ) : (
              <div className="grid aspect-[4/3] w-full max-w-sm place-items-center rounded-xl border border-dashed border-stone-200 text-stone-300">
                <span className="text-xs">Chưa có ảnh</span>
              </div>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  )
}