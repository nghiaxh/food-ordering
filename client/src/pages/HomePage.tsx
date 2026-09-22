import { useEffect } from 'react'
import { Button, Carousel, Empty, Form, Input, message } from 'antd'
import { Link } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import SectionHeader from '../components/SectionHeader'
import FoodCard from '../components/FoodCard'
import Reveal from '../components/Reveal'
import UiIcon from '../components/UiIcon'
import UiImg from '../components/UiImg'
import { BANNERS, CONTACT, FEATURES, HERO, STEPS, TESTIMONIALS } from '../data/home'

const ABOUT_POINTS = [
  'Nguyên liệu được nhập mới mỗi sáng từ nguồn cung kiểm định',
  'Đầu bếp hơn 10 năm kinh nghiệm, giữ vẹn hương vị truyền thống',
  'Đóng gói chuẩn vệ sinh an toàn thực phẩm, giao trong 30–45 phút',
]

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/70 ${className}`} />
}

const CONTACT_ITEMS = [
  { icon: 'phone', label: 'Hotline', value: CONTACT.phone },
  { icon: 'envelope', label: 'Email', value: CONTACT.email },
  { icon: 'map-marker', label: 'Địa chỉ', value: CONTACT.address },
  { icon: 'clock', label: 'Giờ mở cửa', value: CONTACT.hours },
]

export default function HomePage() {
  const { data, loading, error } = useAsyncData(
    (signal) => Promise.all([getCategories(signal), getFoods(undefined, signal)]),
    [],
  )
  const categories = data?.[0] ?? []
  const foods = data?.[1] ?? []

  useEffect(() => {
    if (error) message.error('Không tải được dữ liệu từ máy chủ')
  }, [error])

  const featured = foods.filter((f) => f.available).slice(0, 8)

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-stone-950">
        <img
          src="/images/hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-stone-950/25" />
        <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center px-4 py-16 md:min-h-[600px]">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-balance text-white md:text-6xl">
              {HERO.titleA} <span className="text-amber-400">{HERO.titleHighlight}</span>{' '}
              {HERO.titleB}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-200">{HERO.subtitle}</p>
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
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <Carousel autoplay autoplaySpeed={5000} arrows>
          {BANNERS.map((b) => (
            <div key={b.title}>
              <div className="relative h-64 overflow-hidden rounded-2xl border border-stone-200/70 md:h-80">
                <img src={b.image} alt={b.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 to-transparent" />
                <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-8 md:px-14">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                    {b.tag}
                  </span>
                  <h3 className="mt-3 max-w-lg text-2xl font-bold tracking-tight text-balance text-white md:text-3xl">
                    {b.title}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-200 md:text-base">
                    {b.subtitle}
                  </p>
                  <Link
                    to="/foods"
                    className="mt-4 flex w-fit items-center gap-1 text-sm font-medium text-white underline-offset-4 hover:underline"
                  >
                    Đặt món ngay <UiIcon name="arrow-right" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <SectionHeader
          title="Vì sao chọn FoodOrdering?"
          subtitle="Chúng tôi chăm chút từng món ăn, từ nguyên liệu đến lúc giao đến tay bạn."
        />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-200/70 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-6">
              <h3 className="font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeader
            title="Khám phá theo loại món"
            subtitle="Từ món Việt đậm đà đến món Âu tinh tế — đều có trong thực đơn."
          />
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <PulseBlock key={i} className="aspect-[4/3]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/foods?category=${c.id}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-100"
                >
                  <UiImg
                    src={c.imageUrl}
                    alt={c.name}
                    className="transition duration-300 group-hover:scale-105"
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
          title="Cách đặt món chỉ trong 4 bước"
          subtitle="Quy trình đơn giản, minh bạch từ lúc chọn món đến khi nhận hàng."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.no} className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
              <div className="relative aspect-[4/3]">
                <UiImg src={s.image} alt={s.title} />
              </div>
              <div className="p-5">
                <span className="text-sm font-bold tracking-wide text-amber-700">{s.no}</span>
                <h3 className="mt-1 font-semibold text-stone-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured foods */}
      <Reveal>
        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHeader
              title="Món ăn được yêu thích"
              subtitle="Những lựa chọn được nhiều khách hàng gọi nhất — đặt ngay trước khi hết!"
            />
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PulseBlock key={i} className="h-64" />
                ))}
              </div>
            ) : featured.length === 0 ? (
              <Empty description="Chưa có món ăn nào" />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((f) => (
                  <FoodCard key={f.id} food={f} />
                ))}
              </div>
            )}
            <div className="mt-10 text-center">
              <Link to="/foods">
                <Button size="large">
                  Xem toàn bộ thực đơn <UiIcon name="arrow-right" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* About */}
      <Reveal>
        <section id="about" className="mx-auto max-w-7xl px-4 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200/70">
              <img
                src="/images/about-1.jpg"
                alt="Không gian ấm cúng của FoodOrdering"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div>
              <SectionHeader
                align="left"
                title="Câu chuyện về nhà hàng của chúng tôi"
                subtitle="Bắt đầu từ một quán ăn nhỏ, giờ đây FoodOrdering là điểm đến của những tín đồ ẩm thực."
              />
              <p className="leading-relaxed text-stone-600">
                Chúng tôi tin mỗi món ăn đều kể một câu chuyện riêng. Đó là lý do mọi công thức đều
                được nghiên cứu kỹ, nấu bằng trái tim và phục vụ bằng sự chu đáo nhất.
              </p>
              <ul className="mt-6 space-y-3">
                {ABOUT_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 leading-relaxed text-stone-700">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                      <UiIcon name="check" size={12} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-8">
                <Link to="/foods">
                  <Button type="primary" size="large">
                    Khám phá thực đơn
                  </Button>
                </Link>
                <span className="text-sm text-stone-400">8+ năm phục vụ khách hàng</span>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Testimonials */}
      <section className="bg-stone-900 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeader title="Khách hàng nói gì về chúng tôi" eyebrow="Cảm nhận" />
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="h-full border border-stone-700/70 bg-stone-800 p-6">
                <p className="leading-relaxed text-stone-300">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5">
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-sm text-stone-400">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-7xl px-4 pt-16">
        <SectionHeader
          title="Liên hệ & đặt bàn"
          subtitle="Gọi điện hoặc để lại lời nhắn, đội ngũ chúng tôi sẽ phản hồi trong vòng 1 giờ."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {CONTACT_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 rounded-2xl border border-stone-200/70 bg-white p-5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-lg text-stone-600">
                  <UiIcon name={item.icon} />
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">{item.label}</div>
                  <div className="font-medium text-stone-900">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-stone-200/70 bg-white p-6">
            <Form
              layout="vertical"
              onFinish={() => message.success('Cảm ơn bạn! Chúng tôi sẽ liên hệ sớm.')}
            >
              <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
                <Input placeholder="0968.xxx.xxx" />
              </Form.Item>
              <Form.Item name="note" label="Lời nhắn">
                <Input.TextArea rows={3} placeholder="Bạn muốn đặt bàn hay có câu hỏi gì?" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
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