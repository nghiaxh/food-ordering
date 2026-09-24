import { useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteCategory, adminSaveCategory, getCategories, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Category } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import { slugify } from '../../utils/slug'
import UiImg from '../../components/UiImg'
import { EmptyState, PageHeader } from './shared'

export default function AdminCategoriesPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const imageUrl = Form.useWatch('imageUrl', form)

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

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <div className="h-32 rounded-t-2xl bg-stone-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-1/3 rounded-full bg-stone-100" />
                <div className="h-3 w-1/2 rounded-full bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70"
            >
              <div className="relative">
                <UiImg
                  src={c.imageUrl}
                  alt={c.name}
                  imgClass="h-32 w-full object-cover"
                  className="transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-stone-900/40 opacity-0 transition group-hover:opacity-100">
                  <Button size="small" className="!bg-white" onClick={() => openEdit(c)}>
                    Sửa
                  </Button>
                  <Popconfirm title="Xóa danh mục này?" onConfirm={() => remove(c.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} loading={busyId === c.id}>
                      Xóa
                    </Button>
                  </Popconfirm>
                </div>
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-stone-800">{c.name}</p>
                <p className="mt-0.5 text-xs text-stone-400">{counts.get(c.id) ?? 0} món ăn</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
          <EmptyState
            icon="th-large"
            title="Chưa có danh mục nào."
            hint="Tạo danh mục đầu tiên để tổ chức thực đơn."
            action={
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tạo danh mục
              </Button>
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
          <Form.Item name="imageUrl" label="URL Ảnh">
            <Input placeholder="https://..." allowClear />
          </Form.Item>
          {imageUrl ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-400">Xem trước</p>
              <UiImg
                src={imageUrl}
                alt="Xem trước ảnh danh mục"
                imgClass="h-28 w-full max-w-xs rounded-xl border border-stone-100 object-cover"
              />
            </div>
          ) : null}
        </Form>
      </Modal>
    </div>
  )
}