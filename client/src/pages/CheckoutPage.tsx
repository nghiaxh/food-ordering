import { useEffect, useState } from 'react'
import { Empty, Form, Input, Radio, Skeleton, message } from 'antd'
import { EditOutlined, BankOutlined, QrcodeOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { createOrder, getAddresses, saveAddress } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import useCartQuote from '../hooks/useCartQuote'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import type { SavedAddress } from '../types'
import { formatVND } from '../utils/format'
import { PHONE_RULE } from '../utils/validators'
import { apiErrorMessage } from '../utils/api-error'
import UiButton from '../components/UiButton'
import UiImg from '../components/UiImg'
import FormModal from '../components/FormModal'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255
const NOTE_SUGGESTIONS = ['Ít cay', 'Không hành', 'Gọi trước 10 phút']

/**
 * Trang đặt món duy nhất. Danh sách món sửa được đã chuyển sang drawer giỏ; ở đây chỉ còn
 * thông tin giao hàng, thanh toán và tóm tắt tiền. Server vẫn là nơi tính tiền duy nhất
 * qua `useCartQuote`; client không tự nhân phần trăm hay trừ khuyến mãi.
 */
export default function CheckoutPage() {
  const { items, loaded, clear, count } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [ordering, setOrdering] = useState(false)
  const [form] = Form.useForm()
  const [addrForm] = Form.useForm()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [addressModal, setAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const { quote, quoteLoading, quoteError, quoteStale } = useCartQuote(items)

  const { run: submitOrder, pending: submitting } = useAsyncAction(
    (payload: {
      items: { foodId?: number; quantity: number }[]
      receiverName: string
      phone: string
      address: string
      paymentMethod: string
      note?: string
    }) => createOrder(payload),
  )

  useEffect(() => {
    if (!user) return
    getAddresses()
      .then(setAddresses)
      .catch(() => setAddresses([]))
  }, [user])

  useEffect(() => {
    const address = addresses.find((a) => a.isDefault) ?? addresses[0]
    if (address) applyAddress(address)
  }, [addresses])

  const applyAddress = (address: SavedAddress) => {
    setSelectedId(address.id)
    form.setFieldsValue({
      receiverName: address.receiverName,
      phone: address.phone,
      address: address.address,
    })
  }

  const openAddressModal = (address?: SavedAddress) => {
    setEditingAddress(address ?? null)
    addrForm.resetFields()
    if (address) {
      addrForm.setFieldsValue({
        label: address.label,
        receiverName: address.receiverName,
        phone: address.phone,
        address: address.address,
      })
    }
    setAddressModal(true)
  }

  const submitAddress = async (v: {
    label?: string
    receiverName: string
    phone: string
    address: string
  }) => {
    try {
      setSavingAddress(true)
      const saved = await saveAddress(editingAddress?.id ?? null, {
        label: v.label?.trim() || undefined,
        receiverName: v.receiverName.trim(),
        phone: v.phone,
        address: v.address.trim(),
      })
      setAddresses((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)])
      applyAddress(saved)
      setEditingAddress(null)
      addrForm.resetFields()
      setAddressModal(false)
      message.success('Đã lưu địa chỉ giao hàng')
    } catch {
      message.error('Không lưu được địa chỉ. Kiểm tra lại thông tin.')
    } finally {
      setSavingAddress(false)
    }
  }

  const addNote = (text: string) => {
    const current = String(form.getFieldValue('note') ?? '').trim()
    if (current.toLowerCase().includes(text.toLowerCase())) return
    form.setFieldValue('note', current ? `${current}. ${text}` : text)
  }

  const checkout = async (v: {
    receiverName: string
    phone: string
    address: string
    paymentMethod: string
    note?: string
  }) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đặt món')
      navigate('/login')
      return
    }
    if (submitting || ordering) return
    if (!quote || quoteLoading || quoteError) return
    setOrdering(true)
    const res = await submitOrder({
      ...v,
      items: items.map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
    })
    setOrdering(false)
    if (res.ok) {
      await clear()
      message.success('Đặt món thành công')
      navigate('/orders')
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Đặt món thất bại')
    }
  }

  const canSubmit = Boolean(quote) && !quoteLoading && !quoteError && !submitting && !ordering

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton active />
      </div>
    )
  }

  if (user?.role === 'ADMIN') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Empty description="Tài khoản quản trị không thể đặt món">
          <UiButton kind="primary" onClick={() => navigate('/admin')}>
            Về trang quản trị
          </UiButton>
        </Empty>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Empty description="Giỏ hàng của bạn đang trống">
          <div className="flex flex-wrap justify-center gap-2">
            <UiButton kind="default" onClick={() => openDrawer('cart')}>
              Xem giỏ hàng
            </UiButton>
            <UiButton kind="primary" onClick={() => navigate('/')}>
              Khám phá thực đơn
            </UiButton>
          </div>
        </Empty>
      </div>
    )
  }

  const totals = (
    <div className="space-y-1.5 text-sm">
      {quote ? (
        <>
          <div className="flex justify-between text-stone-600">
            <span>Tạm tính</span>
            <span className="tabular-nums">{formatVND(quote.subtotal)}</span>
          </div>
          {quote.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Giảm giá</span>
              <span className="tabular-nums">-{formatVND(quote.discountTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-base font-bold text-stone-900">
            <span>Tổng thanh toán</span>
            <span className="text-lg tabular-nums text-amber-800">{formatVND(quote.total)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-stone-500">
          {quoteError ? 'Không tính được giá, thử lại sau.' : 'Đang cập nhật giá...'}
        </p>
      )}
      <p className="h-4 text-xs text-stone-500" aria-live="polite">
        {quoteStale ? 'Đang cập nhật giá...' : ''}
      </p>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 pb-32 sm:px-6 lg:pb-10">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">Đặt món</h1>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <Form
          form={form}
          id={CHECKOUT_FORM_ID}
          layout="vertical"
          onFinish={checkout}
          initialValues={{ receiverName: user?.fullName, paymentMethod: 'COD' }}
        >
          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-stone-900">Thông tin giao hàng</h2>
              <UiButton kind="default" size="small" onClick={() => openAddressModal()}>
                Thêm địa chỉ
              </UiButton>
            </div>

            {addresses.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {addresses.map((address) => {
                  const active = address.id === selectedId
                  return (
                    <div
                      key={address.id}
                      className={`relative rounded-xl p-3 text-left ring-1 transition ${
                        active
                          ? 'bg-amber-50/70 ring-2 ring-amber-600'
                          : 'bg-white ring-stone-200 hover:ring-amber-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => applyAddress(address)}
                        className="block w-full cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                          {address.label || 'Địa chỉ'}
                          {address.isDefault && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Mặc định
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-stone-900">
                          {address.receiverName} · {address.phone}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                          {address.address}
                        </span>
                      </button>
                      <UiButton
                        kind="icon"
                        size="small"
                        aria-label={`Sửa địa chỉ ${address.label || address.address}`}
                        icon={<EditOutlined />}
                        className="!absolute right-2 top-2"
                        onClick={() => openAddressModal(address)}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-500">
                Chưa có địa chỉ nào. Thêm để đặt món nhanh hơn.
              </p>
            )}

            <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="receiverName"
                label="Người nhận"
                rules={[{ required: true, message: 'Nhập tên người nhận' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[{ required: true, message: 'Nhập số điện thoại' }, PHONE_RULE]}
              >
                <Input placeholder="0900000000" inputMode="tel" />
              </Form.Item>
              <Form.Item
                name="address"
                label="Địa chỉ nhận món"
                className="sm:col-span-2"
                rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
            <h2 className="text-base font-bold text-stone-900">Thanh toán</h2>
            <Form.Item name="paymentMethod" className="mt-3 !mb-0">
              <Radio.Group
                className="grid gap-2"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value)
                  form.setFieldValue('paymentMethod', e.target.value)
                }}
              >
                <Radio
                  value="COD"
                  className="!m-0 rounded-xl border p-3 transition hover:border-amber-500 [&.ant-radio-wrapper-checked]:border-amber-600 [&.ant-radio-wrapper-checked]:bg-amber-50/60 [&_.ant-radio]:hidden"
                >
                  <span className="flex w-full items-center gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                        paymentMethod === 'COD' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      <BankOutlined style={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-stone-900">Tiền mặt khi nhận</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                        Trả trực tiếp cho shipper khi nhận món.
                      </span>
                    </span>
                    {paymentMethod === 'COD' && (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-600 text-white">
                        <CheckOutlined style={{ fontSize: 11 }} />
                      </span>
                    )}
                  </span>
                </Radio>
                <Radio
                  value="QR"
                  className="!m-0 rounded-xl border p-3 transition hover:border-amber-500 [&.ant-radio-wrapper-checked]:border-amber-600 [&.ant-radio-wrapper-checked]:bg-amber-50/60 [&_.ant-radio]:hidden"
                >
                  <span className="flex w-full items-center gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                        paymentMethod === 'QR' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      <QrcodeOutlined style={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-stone-900">Chuyển khoản QR</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                        Quét mã QR để điền sẵn số tiền và nội dung.
                      </span>
                    </span>
                    {paymentMethod === 'QR' && (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-600 text-white">
                        <CheckOutlined style={{ fontSize: 11 }} />
                      </span>
                    )}
                  </span>
                </Radio>
              </Radio.Group>
            </Form.Item>
          </section>

          <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
            <h2 className="text-base font-bold text-stone-900">Lưu ý cho quán</h2>
            <Form.Item
              name="note"
              className="mt-3 !mb-0"
              rules={[{ max: NOTE_MAX_LENGTH, message: `Lưu ý không được vượt quá ${NOTE_MAX_LENGTH} ký tự` }]}
            >
              <Input.TextArea
                rows={3}
                showCount
                maxLength={NOTE_MAX_LENGTH}
                placeholder="Ví dụ: ít cay, không hành, gọi trước 10 phút"
              />
            </Form.Item>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-stone-400">Gợi ý:</span>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {NOTE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addNote(s)}
                    className="cursor-pointer rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-amber-100 hover:text-amber-800"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </Form>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200/60 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900">Đơn hàng của bạn</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {items.length} món · {count()} phần
                </p>
              </div>
              <button
                type="button"
                onClick={() => openDrawer('cart')}
                className="shrink-0 cursor-pointer text-xs font-semibold text-amber-800 hover:underline"
              >
                Sửa giỏ
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {items.slice(0, 3).map((i) => {
                const line = quote?.lines.find((l) => l.foodId === i.food?.id)
                return (
                  <div key={i.food?.id ?? i.quantity} className="flex items-center gap-2.5">
                    <UiImg
                      src={i.food?.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                      <span className="font-semibold tabular-nums">{i.quantity}x</span>{' '}
                      {i.food?.name ?? 'Món'}
                    </span>
                    {line && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                        {formatVND(line.lineTotal)}
                      </span>
                    )}
                  </div>
                )
              })}
              {items.length > 3 && (
                <p className="text-xs text-stone-400">+{items.length - 3} món nữa</p>
              )}
            </div>

            <div className="mt-3">{totals}</div>

            <UiButton
              kind="primary-lg"
              htmlType="submit"
              form={CHECKOUT_FORM_ID}
              className="mt-2 hidden w-full lg:flex"
              loading={submitting || ordering}
              disabled={!canSubmit}
            >
              Xác nhận đặt món
            </UiButton>
          </div>
        </aside>
      </div>

      <FormModal
        title={editingAddress ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
        open={addressModal}
        onClose={() => {
          setEditingAddress(null)
          addrForm.resetFields()
          setAddressModal(false)
        }}
        onSubmit={() => addrForm.submit()}
        saving={savingAddress}
      >
        <Form form={addrForm} layout="vertical" className="mt-4" onFinish={submitAddress}>
          <Form.Item
            name="label"
            label="Nhãn (ví dụ Nhà riêng, Cơ quan)"
            rules={[{ max: 50, message: 'Nhãn tối đa 50 ký tự' }]}
          >
            <Input placeholder="Ví dụ: Nhà riêng" />
          </Form.Item>
          <Form.Item
            name="receiverName"
            label="Người nhận"
            rules={[{ required: true, message: 'Nhập tên người nhận' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Nhập số điện thoại' }, PHONE_RULE]}
          >
            <Input placeholder="0900000000" inputMode="tel" />
          </Form.Item>
          <Form.Item
            name="address"
            label="Địa chỉ nhận món"
            rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </FormModal>

      {/* Thanh đáy mobile: tổng tiền và CTA duy nhất, field cuối đã có padding tránh bị che. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <span className="block text-xs text-stone-500">Tổng cộng</span>
            <span className="text-base font-bold tabular-nums text-amber-800">
              {quote ? formatVND(quote.total) : quoteError ? 'Lỗi tính giá' : 'Đang tính...'}
            </span>
            {quoteStale && <span className="ml-1 text-[11px] text-stone-500">đang cập nhật</span>}
          </div>
          <UiButton
            kind="primary-lg"
            htmlType="submit"
            form={CHECKOUT_FORM_ID}
            loading={submitting || ordering}
            disabled={!canSubmit}
            className="shrink-0"
          >
            Đặt món
          </UiButton>
        </div>
      </div>

      {/* Nút mở giỏ cho màn hình hẹp khi cần sửa món; thanh đáy chỉ chứa CTA. */}
    </div>
  )
}
