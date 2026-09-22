import { useEffect, useState } from 'react'
import { Button, Empty, Input, InputNumber, Skeleton, Space, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import type { Category, Food } from '../types'
import FoodCard from '../components/FoodCard'

export default function FoodsPage() {
  const [searchParams] = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [keyword, setKeyword] = useState('')
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('category') ? Number(searchParams.get('category')) : undefined,
  )
  const [loading, setLoading] = useState(true)

  const load = (catId: number | undefined, kw: string, min: number | null, max: number | null) =>
    getFoods({
      keyword: kw || undefined,
      categoryId: catId,
      minPrice: min ?? undefined,
      maxPrice: max ?? undefined,
    })
      .then(setFoods)
      .catch(() => message.error('Không tải được thực đơn'))
      .finally(() => setLoading(false))

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined)
  }, [])

  useEffect(() => {
    setLoading(true)
    load(categoryId, keyword, minPrice, maxPrice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const applyFilters = () => {
    setLoading(true)
    load(categoryId, keyword, minPrice, maxPrice)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Thực đơn
      </div>
      <h1 className="text-3xl font-bold text-stone-900">Khám phá món ăn</h1>
      <p className="mt-2 text-stone-500">
        Tìm theo tên, danh mục hoặc khoảng giá. Chưa biết ăn gì? Bấm chatbot để được tư vấn.
      </p>

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
        <Button
          onClick={() => {
            setKeyword('')
            setMinPrice(null)
            setMaxPrice(null)
            setCategoryId(undefined)
          }}
        >
          Đặt lại
        </Button>
      </div>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryId(undefined)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            categoryId === undefined
              ? 'bg-amber-600 text-white'
              : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-amber-50'
          }`}
        >
          Tất cả
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              categoryId === c.id
                ? 'bg-amber-600 text-white'
                : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-amber-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton.Node key={i} active style={{ width: '100%', height: 320 }} />
            ))}
          </div>
        ) : foods.length === 0 ? (
          <Empty description="Không tìm thấy món phù hợp. Thử bỏ bớt bộ lọc hoặc hỏi chatbot nhé!" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {foods.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}