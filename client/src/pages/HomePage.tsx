import { useEffect, useState } from 'react'
import { Button, Carousel, Empty, Form, Input, Rate, message, Skeleton } from 'antd'
import { ArrowRightOutlined, FireOutlined, PhoneOutlined, EnvironmentOutlined, ClockCircleOutlined, MailOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import type { Category, Food } from '../types'
import SectionHeader from '../components/SectionHeader'
import FoodCard from '../components/FoodCard'
import { BANNERS, CONTACT, FEATURES, HERO, STEPS, TESTIMONIALS } from '../data/home'

const ABOUT_POINTS = [
  'Nguyên liệu được nhập mới mỗi sáng từ nguồn cung kiểm định',
  'Đầu bếp hơn 10 năm kinh nghiệm, giữ vẹn hương vị truyền thống',
  'Đóng gói chuẩn vệ sinh an toàn thực phẩm, giao trong 30–45 phút',
]

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCategories(), getFoods()])
      .then(([cats, items]) => {
        setCategories(cats)
        setFoods(items)
      })
      .catch(() => message.error('Không tải được dữ liệu từ máy chủ'))
      .finally(() => setLoading(false))
  }, [])

  const featured = foods.filter((f) => f.available).slice(0, 8)

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-stone-950">
        <img
          src="/images/hero.jpg"
          alt="Món ăn FoodOrdering"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-stone-950/20" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-400 ring-1 ring-amber-500/30">
              {HERO.badge}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white md:text-6xl">
              {HERO.titleA}{' '}
              <span className="text-amber-500">{HERO.titleHighlight}</span>{' '}
              {HERO.titleB}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-stone-200">{HERO.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/foods">
                <Button type="primary" size="large" icon={<FireOutlined />}>
                  Xem thực đơn
                </Button>
              </Link>
              <Link to="/foods">
                <Button size="large">Khám phá món mới</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Banner carousel */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <Carousel autoplay>
          {BANNERS.map((b) => (
            <div key={b.title}>
              <div className="relative h-60 overflow-hidden rounded-3xl md:h-80">
                <img src={b.image} alt={b.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 to-transparent" />
                <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-8 md:px-14">
                  <span className="w-fit rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-stone-950">
                    {b.tag}
                  </span>
                  <h3 className="mt-3 max-w-lg text-2xl font-bold text-white md:text-3xl">{b.title}</h3>
                  <p className="mt-2 max-w-md text-sm text-stone-200 md:text-base">{b.subtitle}</p>
                  <Link to="/foods" className="mt-4 w-fit text-sm font-semibold text-amber-400 hover:text-amber-300">
                    Đặt món ngay <ArrowRightOutlined />
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <img src={f.image} alt={f.title} className="h-36 w-full object-cover" loading="lazy" />
              <div className="p-5">
                <h3 className="font-semibold text-stone-900">{f.title}</h3>
                <p className="mt-2 text-sm text-stone-500">{f.desc}</p>
              </div>
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
                <Skeleton.Node key={i} active style={{ width: '100%', height: 180 }} />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/foods?category=${c.id}`}
                  className="group relative h-44 overflow-hidden rounded-2xl shadow-sm ring-1 ring-stone-200/60"
                >
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <span className="text-sm text-amber-400 group-hover:underline">Xem món ngay</span>
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.no} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
              <div className="relative h-36">
                <img src={s.image} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-lg font-bold text-white">
                  {s.no}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-stone-900">{s.title}</h3>
                <p className="mt-2 text-sm text-stone-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured foods */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeader
            title="Món ăn được yêu thích"
            subtitle="Những lựa chọn được nhiều khách hàng gọi nhất — đặt ngay trước khi hết!"
          />
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton.Node key={i} active style={{ width: '100%', height: 300 }} />
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
              <Button size="large" icon={<ArrowRightOutlined />}>
                Xem toàn bộ thực đơn
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <img src="/images/about-1.jpg" alt="Về FoodOrdering" className="w-full rounded-3xl object-cover shadow-lg" />
            <div className="absolute -bottom-5 -right-3 rounded-2xl bg-amber-600 px-6 py-4 text-white shadow-xl md:-right-5">
              <div className="text-3xl font-extrabold">8+</div>
              <div className="text-sm text-amber-100">năm phục vụ khách hàng</div>
            </div>
          </div>
          <div>
            <SectionHeader
              align="left"
              title="Câu chuyện về nhà hàng của chúng tôi"
              subtitle="Bắt đầu từ một quán ăn nhỏ, giờ đây FoodOrdering là điểm đến của những tín đồ ẩm thực."
            />
            <p className="text-stone-600">
              Chúng tôi tin mỗi món ăn đều kể một câu chuyện riêng. Đó là lý do mọi công thức đều
              được nghiên cứu kỹ, nấu bằng trái tim và phục vụ bằng sự chu đáo nhất.
            </p>
            <ul className="mt-6 space-y-3">
              {ABOUT_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-stone-700">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-700">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link to="/foods">
              <Button type="primary" size="large" className="mt-8">
                Khám phá thực đơn
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-stone-900 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHeader title="Khách hàng nói gì về chúng tôi" />
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl bg-stone-800 p-6 ring-1 ring-stone-700">
                <Rate disabled defaultValue={5} style={{ fontSize: 14 }} />
                <p className="mt-4 text-stone-300">&ldquo;{t.quote}&rdquo;</p>
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
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <SectionHeader
          title="Liên hệ & đặt bàn"
          subtitle="Gọi điện hoặc để lại lời nhắn, đội ngũ chúng tôi sẽ phản hồi trong vòng 1 giờ."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {[
              { icon: <PhoneOutlined />, label: 'Hotline', value: CONTACT.phone },
              { icon: <MailOutlined />, label: 'Email', value: CONTACT.email },
              { icon: <EnvironmentOutlined />, label: 'Địa chỉ', value: CONTACT.address },
              { icon: <ClockCircleOutlined />, label: 'Giờ mở cửa', value: CONTACT.hours },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200/60">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-700">
                  {item.icon}
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">{item.label}</div>
                  <div className="font-medium text-stone-900">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
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
        <div className="relative overflow-hidden rounded-3xl bg-amber-600 px-8 py-12 text-center">
          <img src="/images/banners/banner-1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <h3 className="relative text-3xl font-extrabold text-white">Sẵn sàng để thưởng thức món ngon?</h3>
          <p className="relative mt-2 text-amber-100">Đặt món ngay hoặc để chatbot AI gợi ý theo khẩu vị của bạn.</p>
          <div className="relative mt-6 flex justify-center gap-3">
            <Link to="/foods">
              <Button size="large" type="default" className="!border-white !text-white !bg-transparent">
                Xem thực đơn
              </Button>
            </Link>
            <Link to="/cart">
              <Button size="large" type="primary" className="!bg-stone-950 !border-stone-950">
                Đi tới giỏ hàng
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}