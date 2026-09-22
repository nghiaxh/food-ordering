import { useMemo, useState } from 'react'
import { Button, Card, Form, Input, List, Modal, Popconfirm, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { adminDeleteCategory, adminSaveCategory, getCategories, getFoods } from '../../api/api'
import useAsyncData from '../../hooks/useAsyncData'
import useAsyncAction from '../../hooks/useAsyncAction'
import type { Category } from '../../types'
import { apiErrorMessage } from '../../utils/api-error'
import { slugify } from '../../utils/slug'
import UiImg from '../../components/UiImg'

export default function AdminCategoriesPage() {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const { data, refresh: refreshData } = useAsyncData((signal) => getCategories(signal), [])
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
    setName('')
    setModal(true)
  }

  const openEdit = (c: Category) => {
    setEditing(c)
    setName(c.name)
    setModal(true)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      message.warning('Nhập tên danh mục')
      return
    }
    const res = await saveCategory({
      id: editing?.id ?? null,
      name: trimmed,
      slug: editing?.slug?.trim() ? editing.slug : slugify(trimmed),
      imageUrl: editing?.imageUrl ?? '',
    })
    if (!res.ok) {
      message.error(apiErrorMessage(res.error) ?? 'Lưu thất bại')
      return
    }
    message.success('Đã lưu danh mục')
    setModal(false)
    setName('')
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
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Hiện có <b>{data?.length ?? 0}</b> danh mục trong thực đơn.
        </p>
        <Button icon={<PlusOutlined />} onClick={openCreate}>
          Tạo danh mục
        </Button>
      </div>

      <List
        grid={{ gutter: 16, md: 3 }}
        dataSource={data}
        locale={{ emptyText: 'Chưa có danh mục nào.' }}
        renderItem={(c) => (
          <List.Item>
            <Card
              cover={<UiImg src={c.imageUrl} alt={c.name} imgClass="h-32 w-full object-cover" />}
              actions={[
                <Button key="edit" size="small" onClick={() => openEdit(c)}>
                  Sửa
                </Button>,
                <Popconfirm key="del" title="Xóa danh mục này?" onConfirm={() => remove(c.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} loading={busyId === c.id}>
                    Xóa
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={c.name}
                description={`${counts.get(c.id) ?? 0} món ăn`}
              />
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={editing ? `Sửa: ${editing.name}` : 'Tạo danh mục'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={save}
        confirmLoading={saving}
        okButtonProps={{ children: 'Lưu' }}
        cancelButtonProps={{ children: 'Hủy' }}
      >
        <Form layout="vertical">
          <Form.Item label="Tên danh mục" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Món Việt"
              onPressEnter={save}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}