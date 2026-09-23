import { useEffect, useState } from 'react'
import { Button, Empty, Input, InputNumber, Select, Space, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import type { Food } from '../types'
import FoodCard from '../components/FoodCard'

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc'

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

export default function FoodsPage() {
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('category') ? Number(searchParams.get('category')) : undefined,
  )
  const [sort, setSort] = useState<SortKey>('featured')
  const [applyNonce, setApplyNonce] = useState(0)

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

  const applyFilters = () => setApplyNonce((n) => n + 1)

  const resetFilters = () => {
    setKeyword('')
    setMinPrice(null)
    setMaxPrice(null)
    setCategoryId(undefined)
    setApplyNonce((n) => n + 1)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input.Search
          placeholder="Tìm món..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={applyFilters}
          enterButton={<SearchOutlined />}
          className="w-full sm:!w-64"
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
        <Button
          onClick={resetFilters}
        >
          Đặt lại
        </Button>
      </div>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(undefined)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              categoryId === undefined
                ? 'bg-amber-600 text-white'
                : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
            }`}
          >
            Tất cả
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                categoryId === c.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <Select
          value={sort}
          onChange={(v) => setSort(v)}
          options={SORT_OPTIONS}
          className="!w-36"
          aria-label="Sắp xếp"
        />
      </div>

      {/* List */}
      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PulseBlock key={i} className="h-72" />
            ))}
          </div>
        ) : (foods?.length ?? 0) === 0 ? (
          <Empty description="Không tìm thấy món phù hợp. Thử bỏ bớt bộ lọc hoặc hỏi chatbot nhé!" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sortFoods(foods ?? [], sort).map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}