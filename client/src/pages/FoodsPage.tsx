import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, InputNumber, Select, Space, message } from 'antd'
import { AppstoreOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import type { Food } from '../types'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import FoodCard from '../components/FoodCard'
import FoodRow from '../components/FoodRow'

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc'
type ViewMode = 'list' | 'grid'

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/70 ${className}`} />
}

const SORT_OPTIONS = [
  { label: 'Nổi bật', value: 'featured' },
  { label: 'Giá tăng dần', value: 'price-asc' },
  { label: 'Giá giảm dần', value: 'price-desc' },
  { label: 'Tên A–Z', value: 'name-asc' },
]

function sortFoods(list: Food[], sort: SortKey): Food[] {
  switch (sort) {
    case 'price-asc':
      return [...list].sort((a, b) => a.price - b.price)
    case 'price-desc':
      return [...list].sort((a, b) => b.price - a.price)
    case 'name-asc':
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    default:
      return list
  }
}

/**
 * Nhóm món theo danh mục để hiển thị section. Thứ tự nhóm theo vị trí danh mục
 * xuất hiện lần đầu trong danh sách đã sắp xếp, món không có danh mục gom cuối.
 */
function groupByCategory(list: Food[]): { name: string; foods: Food[] }[] {
  const groups = new Map<string, Food[]>()
  for (const food of list) {
    const name = food.category?.name ?? 'Món khác'
    const group = groups.get(name)
    if (group) group.push(food)
    else groups.set(name, [food])
  }
  return [...groups].map(([name, foods]) => ({ name, foods }))
}

export default function FoodsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('category') ? Number(searchParams.get('category')) : undefined,
  )
  const [sort, setSort] = useState<SortKey>('featured')
  const [applyNonce, setApplyNonce] = useState(0)
  // Desktop ưu tiên lưới, mobile ưu tiên hàng dọc; không lưu lựa chọn, mỗi lần vào trang dùng lại mặc định.
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'grid' : 'list',
  )

  const count = useCartStore((s) => s.count())
  const total = useCartStore((s) => s.total())

  const { data: categories } = useAsyncData((signal) => getCategories(signal), [])

  const { data: foods, loading, error } = useAsyncData(
    (signal) =>
      getFoods(
        {
          keyword: keyword || undefined,
          categoryId,
          minPrice: minPrice ?? undefined,
          maxPrice: maxPrice ?? undefined,
        },
        signal,
      ),
    [categoryId, applyNonce],
  )

  useEffect(() => {
    if (error) message.error('Không tải được thực đơn')
  }, [error])

  const groups = useMemo(() => groupByCategory(sortFoods(foods ?? [], sort)), [foods, sort])

  const applyFilters = () => setApplyNonce((n) => n + 1)

  const resetFilters = () => {
    setKeyword('')
    setMinPrice(null)
    setMaxPrice(null)
    setCategoryId(undefined)
    setApplyNonce((n) => n + 1)
  }

  const chipClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active ? 'bg-amber-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  return (
    <div className={`mx-auto max-w-7xl px-4 py-10 ${count > 0 ? 'pb-32' : ''}`}>
      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input.Search
          placeholder="Tìm món..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={applyFilters}
          enterButton={<SearchOutlined />}
          className="!w-64"
        />
        <Space.Compact>
          <InputNumber
            placeholder="Giá từ"
            min={0}
            step={10000}
            value={minPrice}
            onChange={(v) => setMinPrice(v)}
            style={{ width: 120 }}
          />
          <InputNumber
            placeholder="Giá đến"
            min={0}
            step={10000}
            value={maxPrice}
            onChange={(v) => setMaxPrice(v)}
            style={{ width: 120 }}
          />
        </Space.Compact>
        <Button type="primary" onClick={applyFilters}>Lọc</Button>
        <Button onClick={resetFilters}>Đặt lại</Button>
      </div>

      {/* Category chips: một hàng cuộn ngang, không xuống dòng */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setCategoryId(undefined)}
            aria-pressed={categoryId === undefined}
            className={chipClass(categoryId === undefined)}
          >
            Tất cả
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              aria-pressed={categoryId === c.id}
              className={chipClass(categoryId === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={sort}
            onChange={(v) => setSort(v)}
            options={SORT_OPTIONS}
            className="!w-36"
            aria-label="Sắp xếp"
          />
          <Space.Compact>
            <Button
              type={view === 'list' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              aria-label="Xem dạng danh sách"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            />
            <Button
              type={view === 'grid' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              aria-label="Xem dạng lưới"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            />
          </Space.Compact>
        </div>
      </div>

      {/* Sections theo danh mục, dùng chung cho cả hai chế độ hiển thị */}
      <div className="mt-8 space-y-10">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60">
                <PulseBlock className="aspect-[4/3]" />
                <div className="space-y-3 p-4">
                  <PulseBlock className="h-4 w-2/3 !rounded-full" />
                  <PulseBlock className="h-3 w-full !rounded-full" />
                  <PulseBlock className="h-3 w-4/5 !rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Empty description="Không tìm thấy món phù hợp. Thử bỏ bớt bộ lọc hoặc hỏi chatbot nhé!" />
        ) : (
          groups.map((group) => (
            <section key={group.name} aria-labelledby={`group-${group.name}`}>
              <h2
                id={`group-${group.name}`}
                className="mb-4 text-lg font-bold tracking-tight text-stone-900"
              >
                {group.name}{' '}
                <span className="text-sm font-medium tabular-nums text-stone-400">({group.foods.length})</span>
              </h2>
              {view === 'grid' ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {group.foods.map((f) => (
                    <FoodCard key={f.id} food={f} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {group.foods.map((f) => (
                    <FoodRow key={f.id} food={f} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      {/* Thanh cố định đáy: tóm tắt giỏ, chỉ hiện khi giỏ có món */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p className="text-sm text-stone-600">
              <b className="font-semibold tabular-nums text-stone-900">{count} món</b>
              <span className="mx-1.5 text-stone-300">·</span>
              <b className="font-semibold tabular-nums text-amber-700">{formatVND(total)}</b>
            </p>
            <Button type="primary" size="large" onClick={() => navigate('/cart')}>
              Xem giỏ
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
