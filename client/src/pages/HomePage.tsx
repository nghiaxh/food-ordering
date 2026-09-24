import { useEffect, useState } from 'react'
import { Button, Form, Input, message } from 'antd'
import { Link } from 'react-router-dom'
import { getCategories } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import SectionHeader from '../components/SectionHeader'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'
import { BANNERS, CONTACT, HERO, STEPS } from '../data/home'

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/70 ${className}`} />
}

const CONTACT_ITEMS = [
  { icon: 'phone', label: 'Hotline', value: CONTACT.phone },
  { icon: 'envelope', label: 'Email', value: CONTACT.email },
  { icon: 'map-marker', label: 'Địa chỉ', value: CONTACT.address },
  { icon: 'clock', label: 'Giờ mở cửa', value: CONTACT.hours },
]

function BannerSlider() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = BANNERS.length

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 5000)
    return () => clearInterval(timer)
  }, [paused, count])

  const go = (i: number) => setIndex(((i % count) + count) % count)

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16">
      <div
        className="relative h-72 overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-950 shadow-sm md:h-80"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {BANNERS.map((b, i) => (
            <div key={b.title} className="relative h-full w-full shrink-0">
              <img
                src={b.image}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover ${
                  i === index
                    ? 'scale-105 transition-transform duration-[5000ms] ease-linear'
                    : 'scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/50 to-stone-950/15" />
              <div className="relative z-10 flex h-full flex-col justify-center px-8 md:px-14">
                <span className="w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                  {b.tag}
                </span>
                <h3 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-balance text-white md:text-3xl">
                  {b.title}
                </h3>
                <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-stone-200 md:block">
                  {b.subtitle}
                </p>
                <Link
                  to="/foods"
                  className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
                >
                  Đặt món ngay <UiIcon name="arrow-right" size={15} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Slide trước"
          onClick={() => go(index - 1)}
          className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-stone-900"
        >
          <UiIcon name="arrow-left" size={15} />
        </button>
        <button
          type="button"
          aria-label="Slide sau"
          onClick={() => go(index + 1)}
          className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-stone-900"
        >
          <UiIcon name="arrow-right" size={15} />
        </button>

        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center">
          <div className="flex items-center gap-1.5">
            {BANNERS.map((b, i) => (
              <button
                key={b.title}
                type="button"
                aria-label={`Chuyển tới slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-amber-400' : 'w-2.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { data: categories, loading, error } = useAsyncData(
    (signal) => getCategories(signal),
    [],
  )

  useEffect(() => {
    if (error) message.error('Không tải được dữ liệu từ máy chủ')
  }, [error])

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-stone-950">
        <img
          src="/images/hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-60 blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-stone-950/25" />
        <div className="relative mx-auto flex min-h-[560px] w-full items-center px-6 py-16 sm:min-h-[640px] sm:px-10 md:min-h-[760px] lg:px-16 xl:px-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-balance text-white md:text-6xl lg:text-7xl">
              {HERO.titleA} <span className="text-amber-400">{HERO.titleHighlight}</span>{' '}
              {HERO.titleB}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-200">{HERO.subtitle}</p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link to="/foods">
                <Button type="primary" size="large" icon={<UiIcon name="fire" />}>
                  Xem thực đơn
                </Button>
              </Link>
              <Link
                to="/foods"
                className="text-sm font-medium text-stone-300 underline-offset-4 hover:text-white hover:underline"
              >
                Khám phá món mới
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Banner carousel */}
      <BannerSlider />

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeader align="left" title="Danh mục món ăn" />
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <PulseBlock key={i} className="aspect-[4/3]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {categories?.map((c) => (
                <Link
                  key={c.id}
                  to={`/foods?category=${c.id}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-100"
                >
                  <UiImg
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-full w-full transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <span className="text-sm font-medium text-stone-200">Xem món ngay</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How to order */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <SectionHeader
          title="Hướng dẫn đặt món"
          subtitle="Chỉ 4 bước đơn giản, từ chọn món đến thưởng thức món ngon."
        />
        <ol className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.no} className="group flex flex-col">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white shadow-sm">
                  {s.no}
                </span>
                <h3 className="font-semibold text-stone-900">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{s.desc}</p>
              <div className="mt-4 aspect-[3/2] overflow-hidden rounded-2xl border border-stone-200/60 bg-stone-100">
                <UiImg
                  src={s.image}
                  alt={s.title}
                  className="h-full w-full transition duration-500 group-hover:scale-105"
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-7xl px-4 pt-16">
        <SectionHeader
          title="Liên hệ & đặt bàn"
          subtitle="Gọi điện hoặc để lại lời nhắn, đội ngũ chúng tôi sẽ phản hồi trong vòng 1 giờ."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="divide-y divide-stone-200/60 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {CONTACT_ITEMS.map((item) => {
              const row = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                    <UiIcon name={item.icon} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-stone-400">{item.label}</div>
                    <div className="mt-0.5 truncate font-medium text-stone-900">{item.value}</div>
                  </div>
                </>
              )
              const rowCls = 'flex items-center gap-3 px-5 py-4'
              if (item.icon === 'phone') {
                return (
                  <a key={item.label} href={`tel:${item.value.replace(/\s/g, '')}`} className={`${rowCls} transition hover:bg-stone-50`}>
                    {row}
                  </a>
                )
              }
              if (item.icon === 'envelope') {
                return (
                  <a key={item.label} href={`mailto:${item.value}`} className={`${rowCls} transition hover:bg-stone-50`}>
                    {row}
                  </a>
                )
              }
              return (
                <div key={item.label} className={rowCls}>
                  {row}
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-stone-200/70 bg-white p-5 md:p-6">
            <h3 className="text-lg font-bold text-stone-900">Gửi lời nhắn</h3>
            <p className="mt-1 text-sm text-stone-500">Chúng tôi phản hồi trong vòng 1 giờ làm việc.</p>
            <Form
              layout="vertical"
              className="contact-form mt-5"
              onFinish={() => message.success('Cảm ơn bạn! Chúng tôi sẽ liên hệ sớm.')}
              onFinishFailed={({ errorFields }) => {
                const first = errorFields[0]?.errors?.[0]
                if (first) message.error(first)
              }}
            >
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                  <Input placeholder="Nguyễn Văn A" />
                </Form.Item>
                <Form.Item
                  name="phone"
                  label="Số điện thoại"
                  rules={[
                    { required: true, message: 'Nhập số điện thoại' },
                    { pattern: /^[0-9+\s.-]{10,15}$/, message: 'Số điện thoại không hợp lệ' },
                  ]}
                >
                  <Input placeholder="0968.xxx.xxx" />
                </Form.Item>
              </div>
              <Form.Item name="message" label="Lời nhắn">
                <Input.TextArea rows={3} placeholder="Bạn muốn đặt bàn hay có câu hỏi gì?" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large">
                Gửi lời nhắn
              </Button>
            </Form>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="rounded-2xl bg-stone-950 px-8 py-12 text-center">
          <h3 className="text-3xl font-bold tracking-tight text-balance text-white">
            Sẵn sàng để thưởng thức món ngon?
          </h3>
          <p className="mt-2 text-stone-300">Đặt món ngay hoặc để chatbot AI gợi ý theo khẩu vị của bạn.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/foods">
              <Button size="large" type="default" className="!border-white/40 !text-white !bg-transparent">
                Xem thực đơn
              </Button>
            </Link>
            <Link to="/cart">
              <Button size="large" type="primary" className="!bg-amber-600 !border-amber-600">
                Đi tới giỏ hàng
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}