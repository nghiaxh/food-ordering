import { useEffect, useState } from 'react'
import {
  Button, Card, Checkbox, Col, Divider, Form, Input, InputNumber, List, message,
  Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Upload,
} from 'antd'
import {
  DeleteOutlined, InfoCircleOutlined, PlusOutlined, UploadOutlined,
} from '@ant-design/icons'
import {
  adminDeleteCategory, adminDeleteDocument, adminDeleteFood,
  adminGetChatHistory, adminGetDocuments, adminGetOrders, adminGetSettings, adminGetUsers,
  adminSaveCategory, adminSaveFood, adminSaveSetting,
  adminSetUserActive, adminUpdateOrderStatus, adminUploadDocument,
  getCategories, getFoods,
} from '../../api/api'
import type {
  Category, ChatHistoryMessage, Food, KnowledgeDocument, Order, OrderStatus, User,
} from '../../types'
import { formatVND } from '../../utils/format'
import UiImg from '../../components/UiImg'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chế biến',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'gold',
  CONFIRMED: 'blue',
  PREPARING: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

function FoodsTab() {
  const [data, setData] = useState<Food[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setData(await getFoods())
    setCats(await getCategories())
  }
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setSaving(true)
    try {
      await adminSaveFood(editing?.id ?? null, {
        ...v,
        imageUrl: (v.imageUrl as string)?.trim() || '/images/hero.jpg',
        price: Number(v.price),
        spicyLevel: Number(v.spicyLevel),
        servingSize: Number(v.servingSize),
      })
      message.success(editing ? 'Đã cập nhật món ăn!' : 'Đã tạo món ăn!')
      setModal(false)
      await fetchData()
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id: number) => {
    try {
      await adminDeleteFood(id)
      message.success('Đã xóa món ăn')
      await fetchData()
    } catch {
      message.error('Xóa thất bại')
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500">Quản lý thực đơn: CRUD món ăn, giá tiền, độ cay, chế độ ăn.</p>
        <Button icon={<PlusOutlined />} onClick={openCreate}>Tạo món</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={data}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Món',
            render: (_, f) => (
              <div className="flex items-center gap-3">
                <UiImg
                  src={f.imageUrl}
                  alt={f.name}
                  imgClass="h-12 w-12 rounded-lg object-cover"
                />
                <div className="text-stone-800">{f.name}</div>
              </div>
            ),
          },
          { title: 'Danh mục', width: 140, render: (_, f) => <Tag>{f.category?.name ?? '—'}</Tag> },
          { title: 'Giá', width: 140, render: (_, f) => formatVND(f.price) },
          { title: 'Độ cay', width: 110, render: (_, f) => SPICY[f.spicyLevel] ?? '—' },
          {
            title: 'Trạng thái',
            width: 130,
            render: (_, f) => <Tag color={f.available ? 'green' : 'red'}>{f.available ? 'Bán' : 'Ẩn'}</Tag>,
          },
          {
            title: 'Thao tác',
            width: 150,
            render: (_, f) => (
              <Space>
                <Button size="small" onClick={() => openEdit(f)}>Sửa</Button>
                <Popconfirm title="Xóa món này?" onConfirm={() => remove(f.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? `Sửa món: ${editing.name}` : 'Tạo món mới'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={640}
      >
        <Form form={form} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} onFinish={submit} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên món" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
            <Select options={cats.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ingredients" label="Nguyên liệu">
            <Input.TextArea rows={2} placeholder="Thịt, rau, gia vị..." />
          </Form.Item>
          <Form.Item name="price" label="Giá (đ)" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber min={0} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Row>
            <Col span={12}>
              <Form.Item name="servingSize" label="Khẩu phần (người)"><InputNumber min={1} /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="spicyLevel" label="Độ cay"><Select options={SPICY.map((s, i) => ({ label: s, value: i }))} /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="dietaryTags" label="Chế độ ăn"><Input placeholder="Vegetarian, Gluten-Free..." /></Form.Item>
          <Form.Item name="allergens" label="Dị ứng"><Input placeholder="Gluten, Tôm..." /></Form.Item>
          <Form.Item name="imageUrl" label="URL Ảnh"><Input placeholder="Bỏ trống để dùng ảnh mặc định" /></Form.Item>
          <Form.Item name="available" label="Đang bán" valuePropName="checked">
            <Checkbox>Hiển thị trên thực đơn</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function CategoriesTab() {
  const [data, setData] = useState<Category[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = () => getCategories().then(setData)
  useEffect(() => {
    fetchData()
  }, [])

  const save = async () => {
    if (!name.trim()) {
      message.warning('Nhập tên danh mục')
      return
    }
    setSaving(true)
    try {
      await adminSaveCategory(editing?.id ?? null, name.trim())
      message.success('Đã lưu danh mục')
      setModal(false)
      setName('')
      setEditing(null)
      await fetchData()
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500">Tạo và quản lý danh mục món ăn (wo categories &gt; 0).</p>
        <Button icon={<PlusOutlined />} onClick={() => setModal(true)}>Tạo danh mục</Button>
      </div>
      <List
        grid={{ gutter: 16, md: 3 }}
        dataSource={data}
        renderItem={(c) => (
          <List.Item>
            <Card
              cover={<UiImg src={c.imageUrl} alt={c.name} imgClass="h-32 w-full object-cover" />}
              actions={[
                <Button size="small" key="edit" onClick={() => { setEditing(c); setName(c.name); setModal(true) }}>Sửa</Button>,
                <Popconfirm key="del" title="Xóa danh mục này?" onConfirm={async () => { try { await adminDeleteCategory(c.id); message.success('Đã xóa'); await fetchData() } catch { message.error('Xóa thất bại') } }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                </Popconfirm>,
              ]}
            >
              <Card.Meta title={c.name} description={`#${c.id} · slug: ${c.slug}`} />
            </Card>
          </List.Item>
        )}
      />
      <Modal title={editing ? `Sửa: ${editing.name}` : 'Tạo danh mục'} open={modal} onCancel={() => setModal(false)} onOk={save} confirmLoading={saving}>
        <Form layout="vertical">
          <Form.Item label="Tên danh mục">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Món Việt" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [patching, setPatching] = useState(false)

  const fetchData = () => adminGetOrders().then(setOrders)
  useEffect(() => {
    fetchData()
  }, [])

  const changeStatus = async (id: number, status: OrderStatus) => {
    setPatching(true)
    try {
      await adminUpdateOrderStatus(id, status)
      message.success('Đã cập nhật trạng thái')
      await fetchData()
    } catch {
      message.error('Cập nhật thất bại')
    } finally {
      setPatching(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">Tổng cộng: <b>{orders.length}</b> đơn hàng. Bấm đổi trạng thái để cập nhật.</p>
      <Table
        rowKey="id"
        dataSource={orders}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
        columns={[
          { title: 'Mã đơn', width: 90, render: (_, o) => `#${o.id}` },
          { title: 'Khách', width: 140, render: (_, o) => <span className="text-stone-700">{o.receiverName}</span> },
          { title: 'Địa chỉ', render: (_, o) => <span className="text-stone-500">{o.address}</span> },
          { title: 'Món đặt', render: (_, o) => <Tag>{o.items.length} món</Tag> },
          { title: 'Tổng tiền', width: 140, render: (_, o) => <b>{formatVND(o.total)}</b> },
{
              title: 'Trạng thái',
              width: 230,
              render: (_, o) => (
                <Space.Compact>
                  <Tag color={STATUS_COLOR[o.status] ?? 'default'} className="!m-0">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Tag>
                  <Select
                    size="small"
                    value={o.status}
                    loading={patching}
                    onChange={(s) => changeStatus(o.id, s)}
                    style={{ width: 130 }}
                    options={[
                      { label: STATUS_LABEL.PENDING, value: 'PENDING' },
                      { label: STATUS_LABEL.CONFIRMED, value: 'CONFIRMED' },
                      { label: STATUS_LABEL.PREPARING, value: 'PREPARING' },
                      { label: STATUS_LABEL.COMPLETED, value: 'COMPLETED' },
                      { label: STATUS_LABEL.CANCELLED, value: 'CANCELLED' },
                    ]}
                  />
                </Space.Compact>
              ),
            },
        ]}
      />
    </div>
  )
}

function CustomersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [patching, setPatching] = useState(false)

  const fetchData = () => adminGetUsers().then(setUsers)
  useEffect(() => {
    fetchData()
  }, [])

  const toggle = async (u: User) => {
    setPatching(true)
    try {
      await adminSetUserActive(u.id, !u.active)
      message.success('Đã thay đổi trạng thái')
      await fetchData()
    } catch {
      message.error('Cập nhật thất bại')
    } finally {
      setPatching(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">Danh sách tài khoản. Khóa/Vô hiệu tài khoản vi phạm.</p>
      <Table
        rowKey="id"
        dataSource={users}
        pagination={false}
        scroll={{ x: 700 }}
        columns={[
          { title: 'ID', width: 70, render: (_, u) => `#${u.id}` },
          { title: 'Họ tên', render: (_, u) => <span className="text-stone-700">{u.fullName}</span> },
          { title: 'Email', render: (_, u) => <span className="text-stone-500">{u.email}</span> },
          { title: 'Vai trò', width: 120, render: (_, u) => <Tag color={u.role === 'ADMIN' ? 'purple' : 'blue'}>{u.role}</Tag> },
          {
            title: 'Trạng thái',
            width: 160,
            render: (_, u) => (
              <Popconfirm title={`${u.active ? 'Khóa' : 'Kích hoạt'} ${u.fullName}?`} onConfirm={() => toggle(u)}>
                <Button size="small" loading={patching}>
                  {u.active ? 'Khóa' : 'Kích hoạt'}
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </div>
  )
}

function ChatbotTab() {
  const [history, setHistory] = useState<ChatHistoryMessage[]>([])
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [maxSuggestions, setMaxSuggestions] = useState(5)
  const [extraRules, setExtraRules] = useState('')

  const fetchData = async () => {
    const [h, d, s] = await Promise.all([adminGetChatHistory(), adminGetDocuments(), adminGetSettings()])
    setHistory(h)
    setDocuments(d)
    const m = Object.fromEntries(s.map((item) => [item.settingKey, item.settingValue]))
    setMaxSuggestions(Number(m.max_suggestions ?? 5))
    setExtraRules(m.extra_rules ?? '')
  }
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await Promise.all([
        adminSaveSetting('max_suggestions', String(maxSuggestions)),
        adminSaveSetting('extra_rules', extraRules),
      ])
      message.success('Đã lưu cài đặt chatbot')
      await fetchData()
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSavingSettings(false)
    }
  }

  const removeDocument = async (id: number) => {
    try {
      await adminDeleteDocument(id)
      message.success('Đã xóa tài liệu')
      await fetchData()
    } catch {
      message.error('Xóa thất bại')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="font-semibold text-stone-800">1. Cấu hình AI tư vấn</h3>
        <p className="text-xs text-stone-500">
          max_suggestions: nhiều nhất bao nhiêu món AI được gợi ý. extra_rules: yêu cầu phụ (ưu tiên món,
          giờ phục vụ...). Chỉ thêm; AI luôn dựa trên cơ sở dữ liệu món ăn thật.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span>Số món tối đa</span>
          <InputNumber min={1} max={10} value={maxSuggestions} onChange={(v) => setMaxSuggestions(Number(v))} />
        </div>
        <div className="mt-2">
          <Input.TextArea
            rows={3}
            value={extraRules}
            onChange={(e) => setExtraRules(e.target.value)}
            placeholder="Ví dụ: Luôn cảnh báo khách về món có Tôm nếu họ dị ứng..."
          />
        </div>
        <Button type="primary" className="mt-3" loading={savingSettings} onClick={saveSettings}>
          Lưu cài đặt
        </Button>
      </div>

      <Divider />

      <div className="mb-6">
        <h3 className="font-semibold text-stone-800">2. Tài liệu tri thức (RAG)</h3>
        <p className="text-xs text-stone-500">
          Tải lên file .txt, .md hoặc .pdf về món ăn, chính sách... AI sẽ dùng để trả lời chính xác hơn.
        </p>
        <Upload
          accept=".txt,.md,.pdf"
          showUploadList={false}
          customRequest={async (options) => {
            const file = options.file as unknown as File
            if (!file) return
            setUploading(true)
            try {
              await adminUploadDocument(file)
              message.success('Đã upload tài liệu')
              await fetchData()
            } catch {
              message.error('Upload thất bại')
            } finally {
              setUploading(false)
            }
          }}
        >
          <Button
            loading={uploading}
            icon={<UploadOutlined />}
            className="mt-3"
          >
            Upload tài liệu
          </Button>
        </Upload>
        <List
          className="mt-4 !max-w-xl"
          dataSource={documents}
          locale={{ emptyText: 'Chưa có tài liệu' }}
          renderItem={(d) => (
            <List.Item
              actions={[
                <Popconfirm key="del" title="Xóa tài liệu?" onConfirm={() => removeDocument(d.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={d.title}
                description={`${d.content.length.toLocaleString('vi-VN')} ký tự · ${new Date(d.createdAt).toLocaleDateString('vi-VN')}`}
              />
            </List.Item>
          )}
        />
      </div>

      <Divider />

      <div>
        <h3 className="font-semibold text-stone-800">3. Lịch sử chat ({history.length})</h3>
        <p className="mb-3 flex items-center gap-1 text-xs text-stone-500">
          <InfoCircleOutlined /> Các phiên chat gần đây, kèm email người dùng nếu đã đăng nhập.
        </p>
        <Table
          rowKey="id"
          dataSource={history}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Phiên', width: 120, render: (_, h) => <code className="text-xs">{h.sessionId}</code> },
            { title: 'Khách', width: 140, render: (_, h) => h.user ? h.user.email : <Tag>Ẩn danh</Tag> },
            {
              title: 'Tin nhắn',
              render: (_, h) => (
                <div className="flex flex-col gap-1 text-sm">
                  {h.sender === 'BOT' ? (
                    <span className="text-stone-500"><b className="text-amber-700">Bot:</b> {h.content}</span>
                  ) : (
                    <span className="text-stone-500"><b className="text-stone-700">User:</b> {h.content}</span>
                  )}
                </div>
              ),
            },
            { title: 'Thời gian', width: 150, render: (_, h) => new Date(h.createdAt).toLocaleString('vi-VN') },
          ]}
        />
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [active, setActive] = useState('foods')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-700">Admin Panel</div>
        <h1 className="mt-1 text-3xl font-bold text-stone-900">Quản trị FoodOrdering</h1>
        <p className="mt-1 text-sm text-stone-500">Quản lý thực đơn, đơn hàng, khách hàng và chatbot AI.</p>
      </div>
      <Tabs
        defaultActiveKey="foods"
        activeKey={active}
        onChange={setActive}
        items={[
          { key: 'foods', label: 'Món ăn', children: <FoodsTab /> },
          { key: 'categories', label: 'Danh mục', children: <CategoriesTab /> },
          { key: 'orders', label: 'Đơn hàng', children: <OrdersTab /> },
          { key: 'customers', label: 'Khách hàng', children: <CustomersTab /> },
          { key: 'chatbot', label: 'Chatbot', children: <ChatbotTab /> },
        ]}
      />
    </div>
  )
}