import { useEffect, useState } from 'react'
import { Empty, Form, Input, Radio, Select, Skeleton, message } from 'antd'
import { DeleteOutlined, EditOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { createOrder, getAddresses, quoteCart, saveAddress } from '../api/api'
import useAsyncAction from '../hooks/useAsyncAction'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import type { CartQuote, SavedAddress } from '../types'

import { formatVND } from '../utils/format'
import { PHONE_RULE } from '../utils/validators'
import { apiErrorMessage } from '../utils/api-error'
import UiButton from '../components/UiButton'
import UiImg from '../components/UiImg'
import FormModal from '../components/FormModal'

const CHECKOUT_FORM_ID = 'checkout-form'
const NOTE_MAX_LENGTH = 255

export default function CartPage() {
  const { items, loaded, setQuantity, remove, clear, count, total } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [ordering, setOrdering] = useState(false)
  const [form] = Form.useForm()
  const [addrForm] = Form.useForm()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [addressModal, setAddressModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [quote, setQuote] = useState<CartQuote | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('COD')

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

  /**
   * Báo giá lại mỗi khi giỏ hoặc mã đổi. Khách vãng lai chưa có tài khoản nên chưa xem
   * được giảm giá; các con số còn lại vẫn là tạm tính từ giá niêm yết.
   */
  useEffect(() => {
    if (!user || items.length === 0) {
      setQuote(null)
      return
    }
    let alive = true
    quoteCart()
      .then((next) => {
        if (alive) setQuote(next)
      })
      .catch((err: unknown) => {
        if (!alive) return
        message.error(apiErrorMessage(err) ?? 'Không tính được giá giỏ hàng')
      })
    return () => {
      alive = false
    }
  }, [user, items])

  const selectedAddress = addresses.find((a) => a.id === selectedId) ?? null

  const subtotal = quote?.subtotal ?? total()
  const discountTotal = quote?.discountTotal ?? 0
  const grandTotal = quote?.total ?? total()

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
    if (address) addrForm.setFieldsValue({
      label: address.label,
      receiverName: address.receiverName,
      phone: address.phone,
      address: address.address,
    })
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
      setAddresses((prev) => {
        const rest = prev.filter((a) => a.id !== saved.id)
        return [saved, ...rest]
      })
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

  const checkout = async (
    v: {
      receiverName: string
      phone: string
      address: string
      paymentMethod: string
      note?: string
    },
  ) => {
    if (!user) {
      message.warning('Vui lòng đăng nhập để đặt món')
      navigate('/login')
      return
    }
    if (submitting || ordering) return
    setOrdering(true)
    const res = await submitOrder({
      ...v,
      items: items.map((i) => ({ foodId: i.food!.id, quantity: i.quantity })),
    })
    setOrdering(false)
    if (res.ok) {
      await clear()
      // Đặt xong thẳng sang trang đơn hàng để khách theo dõi được ngay, không qua màn hình chờ.
      message.success('Đặt món thành công')
      navigate('/orders')
    } else {
      message.error(apiErrorMessage(res.error) ?? 'Đặt món thất bại')
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton active />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Empty description="Giỏ hàng của bạn đang trống">
          <Link to="/">
            <UiButton kind="primary">Khám phá thực đơn</UiButton>
          </Link>
        </Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-stone-900">Giỏ hàng &amp; Đặt món</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Danh sách dòng món: đổi số lượng, xoá món và tổng tiền */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
          <div className="border-b border-stone-100 px-5 py-3 text-sm font-medium text-stone-500">
            {count()} món trong giỏ
          </div>
          {items.map((i) => {
            const id = i.food!.id
            const name = i.food!.name
            const image = i.food!.imageUrl
            const line = quote?.lines.find((l) => l.foodId === id)
            const price = line?.unitPrice ?? i.food!.price
            const lineTotal = line?.lineTotal ?? price * i.quantity
            const available = i.food!.available
            const dec = () => setQuantity(id, i.quantity - 1)
            const inc = () => setQuantity(id, i.quantity + 1)
            const del = () => remove(id)
            return (
            <div
              key={`f-${id}`}
              className="border-b border-stone-100 px-5 py-4 last:border-b-0 sm:flex sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
                <Link to={`/foods/${i.food!.id}`} className="shrink-0">
                  <UiImg src={image} alt={name} className="h-20 w-20 rounded-xl" />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link to={`/foods/${i.food!.id}`} className="block truncate font-medium text-stone-800 hover:text-amber-700">{name}</Link>
                  <div className="mt-0.5 text-sm text-stone-500">{formatVND(price)} / phần</div>
                  {line && line.lineDiscount > 0 && (
                    <div className="mt-0.5 text-xs font-medium text-emerald-600">
                      {line.discountLabel ? `${line.discountLabel} · ` : ''}-{formatVND(line.lineDiscount)}
                    </div>
                  )}
                  {!available && <div className="mt-1 text-xs font-medium text-red-600">Hết món</div>}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:shrink-0 sm:justify-end">
                <div className="flex items-center rounded-full ring-1 ring-stone-200">
                  <button type="button" aria-label="Giảm số lượng" disabled={i.quantity <= 1} onClick={dec}
                    className="flex h-11 w-11 items-center justify-center rounded-l-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40">
                    <MinusOutlined style={{ fontSize: 12 }} />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                  <button type="button" aria-label="Tăng số lượng" onClick={inc}
                    className="flex h-11 w-11 items-center justify-center rounded-r-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900">
                    <PlusOutlined style={{ fontSize: 12 }} />
                  </button>
                </div>

                <div className="w-24 text-right font-semibold tabular-nums text-stone-900">
                  {formatVND(lineTotal)}
                </div>

                <UiButton kind="icon" danger aria-label="Xóa món" icon={<DeleteOutlined />} onClick={del} />
              </div>
            </div>
            )
          })}

          {/* Tổng tiền và giảm giá tự động */}
          <div className="border-t border-stone-100 bg-stone-50/60 p-4 sm:p-5">
            <div className="mt-1.5 space-y-1.5 border-t border-dashed border-stone-200 pt-3 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Tạm tính</span>
                <span className="tabular-nums">{formatVND(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá</span>
                  <span className="tabular-nums">-{formatVND(discountTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-base font-bold text-stone-900">
                <span>Tổng thanh toán</span>
                <span className="text-lg tabular-nums text-amber-700">{formatVND(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Biểu mẫu đặt món; nút gửi nằm ở thanh cố định đáy để chỉ có một CTA */}
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-96">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <h2 className="text-lg font-bold text-stone-900">Thông tin giao hàng</h2>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-500">Địa chỉ đã lưu</span>
                <UiButton kind="default" size="small" onClick={() => openAddressModal()}>
                  Thêm địa chỉ
                </UiButton>
              </div>
              {addresses.length > 0 ? (
                <>
                  <div className="mt-2 flex items-start gap-2">
                    <Select
                      className="min-w-0 flex-1"
                      value={selectedId}
                      placeholder="Chọn địa chỉ đã lưu"
                      onChange={(id) => {
                        const address = addresses.find((a) => a.id === id)
                        if (address) applyAddress(address)
                      }}
                      options={addresses.map((a) => ({
                        label: a.label || a.address,
                        value: a.id,
                      }))}
                    />
                    {selectedAddress && (
                      <UiButton
                        kind="icon"
                        size="small"
                        aria-label="Sửa địa chỉ đã chọn"
                        icon={<EditOutlined />}
                        onClick={() => openAddressModal(selectedAddress)}
                      />
                    )}
                  </div>
                  {selectedAddress && (
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                      {selectedAddress.receiverName} · {selectedAddress.phone} · {selectedAddress.address}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-400">
                  Chưa có địa chỉ nào. Thêm để đặt món nhanh hơn.
                </p>
              )}
            </div>
            <Form
              form={form}
              id={CHECKOUT_FORM_ID}
              layout="vertical"
              onFinish={checkout}
              className="mt-4"
              initialValues={{ receiverName: user?.fullName, paymentMethod: 'COD' }}
            >
              <Form.Item name="receiverName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: 'Nhập số điện thoại' },
                  PHONE_RULE,
                ]}
              >
                <Input placeholder="0900000000" />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ nhận món" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}>
                <Input />
              </Form.Item>
              {/* Nhóm nút chọn phương thức thanh toán */}
              <Form.Item name="paymentMethod" label="Phương thức thanh toán">
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    form.setFieldValue('paymentMethod', e.target.value)
                  }}
                >
                  <Radio value="COD" className="rounded-xl border border-stone-200 p-3 hover:border-amber-400">
                    <div>
                      <div className="font-medium text-stone-800">Tiền mặt khi nhận hàng (COD)</div>
                      <div className="text-xs text-stone-400">Thanh toán trực tiếp cho shipper khi nhận món</div>
                    </div>
                  </Radio>
                  <Radio value="QR" className="rounded-xl border border-stone-200 p-3 hover:border-amber-400">
                    <div>
                      <div className="font-medium text-stone-800">Chuyển khoản VietQR / Ngân hàng</div>
                      <div className="text-xs text-stone-400">Quét mã QR tự điền số tiền và nội dung chuyển khoản</div>
                    </div>
                  </Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="note"
                label="Lưu ý cho quán"
                extra={<span className="block pt-1">Ví dụ: ít cay, không hành, gọi trước 10 phút</span>}
                rules={[{ max: NOTE_MAX_LENGTH, message: `Lưu ý không được vượt quá ${NOTE_MAX_LENGTH} ký tự` }]}
              >
                <Input.TextArea rows={3} showCount maxLength={NOTE_MAX_LENGTH} placeholder="Ghi chú thêm cho quán" />
              </Form.Item>
            </Form>
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
          <Form.Item name="receiverName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[
              { required: true, message: 'Nhập số điện thoại' },
              PHONE_RULE,
            ]}
          >
            <Input placeholder="0900000000" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ nhận món" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </FormModal>

      {/* Thanh cố định đáy: tổng tiền và nút xác nhận duy nhất của trang */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="text-sm text-stone-600">
            <span className="font-semibold text-stone-900">Tổng cộng: </span>
            <span className="ml-1 text-lg font-bold tabular-nums text-amber-700">{formatVND(grandTotal)}</span>
            {discountTotal > 0 && (
              <span className="ml-2 text-xs text-stone-400 line-through tabular-nums">{formatVND(subtotal)}</span>
            )}
          </div>
          <UiButton
            kind="primary-lg"
            htmlType="submit"
            form={CHECKOUT_FORM_ID}
            loading={submitting || ordering}
            disabled={submitting || ordering}
          >
            Xác nhận đặt món
          </UiButton>
        </div>
      </div>
    </div>
  )
}
