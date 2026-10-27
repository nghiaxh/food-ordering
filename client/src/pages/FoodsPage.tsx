import { useEffect, useState } from 'react'
import { Empty, Pagination, message } from 'antd'
import { Link, useNavigate, Outlet, useSearchParams } from 'react-router-dom'
import { getCategories, getCombos, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import type { Combo } from '../types'
import { formatVND } from '../utils/format'
import FoodCard from '../components/FoodCard'
import UiButton from '../components/UiButton'
import UiImg from '../components/UiImg'

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc'

/** Khoảng giá dạng sẵn dễ chạm hơn hai ô nhập số, vẫn là "lọc khoảng giá" của Bảng 2.22. */
const PRICE_BANDS = [
  { label: 'Mọi giá', min: undefined, max: undefined },
  { label: 'Dưới 50k', min: undefined, max: 50000 },
  { label: '50 – 100k', min: 50000, max: 100000 },
  { label: '100 – 150k', min: 100000, max: 150000 },
  { label: 'Trên 150k', min: 150000, max: undefined },
]

const GRID_COLS = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'

function num(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Trang chủ kiểu kiosk: combo tiết kiệm, chọn nhanh theo danh mục rồi mới tới thực đơn.
 * Bộ lọc của thực đơn nằm trên URL nên chia sẻ được đường dẫn và nút quay lại của trình duyệt
 * không mất trạng thái đang xem.
 */
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
  const { data: combos } = useAsyncData((signal) => getCombos(signal), [])
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

  const totalPages = Math.max(1, Math.ceil((foods?.length ?? 0) / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [page, currentPage])
  const visible = (foods ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const patch = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) merged.delete(key)
      else merged.set(key, value)
    }
    setParams(merged)
    setPage(1)
  }

  const pickCategory = (id?: number) => {
    patch({ category: id?.toString(), combo: undefined })
    document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const combosView = params.get('combo') === '1'

  // Lọc giá dùng chung một dải cho cả món lẫn combo; combo so trên giá gói, đúng bằng giá
  // hiển thị trên thẻ khi không có khuyến mãi riêng cho combo.
  const visibleCombos = (combos ?? []).filter((combo) => {
    const price = Number(combo.price)
    return (minPrice === undefined || price >= minPrice) && (maxPrice === undefined || price <= maxPrice)
  })

  const activePriceBand = PRICE_BANDS.findIndex((b) => b.min === minPrice && b.max === maxPrice)

  const chipBtn = (active: boolean) =>
    `cursor-pointer whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition sm:px-4 sm:py-2.5 sm:text-sm ${
      active ? 'bg-amber-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  return (
    <div className="h-[calc(100dvh-3.25rem)] overflow-y-auto">
      <div className="mx-auto max-w-[1600px] px-3 pb-8 sm:px-6">
        <section id="thuc-don" className="py-5">
          <div className="sticky top-0 z-10 -mx-3 border-b border-stone-200/70 bg-stone-50/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => pickCategory()}
                className={chipBtn(!combosView && categoryId === undefined)}
              >
                Tất cả
              </button>
              {(combos?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => patch({ combo: '1', category: undefined, min: undefined, max: undefined })}
                  className={chipBtn(combosView)}
                >
                  Combo tiết kiệm
                </button>
              )}
              {(categories ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.id)}
                  className={chipBtn(!combosView && categoryId === c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {PRICE_BANDS.map((band, i) => (
                <button
                  key={band.label}
                  type="button"
                  onClick={() =>
                    patch({
                      min: band.min?.toString(),
                      max: band.max?.toString(),
                    })
                  }
                  className={chipBtn(activePriceBand === i)}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {combosView ? (
              visibleCombos.length === 0 ? (
                <Empty description="Không có combo trong khoảng giá này." />
              ) : (
                <div className={`grid gap-3 ${GRID_COLS}`}>
                  {visibleCombos.map((combo) => (
                    <ComboCard key={combo.id} combo={combo} />
                  ))}
                </div>
              )
            ) : loading ? (
              <div className={`grid gap-3 ${GRID_COLS}`}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/60">
                    <div className="aspect-[16/10] animate-pulse bg-stone-200/70" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-stone-200/70" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-stone-200/70" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <Empty description="Không tìm thấy món phù hợp. Thử bỏ bớt bộ lọc hoặc hỏi chatbot nhé!" />
            ) : (
              <>
                <div className={`grid gap-3 ${GRID_COLS}`}>
                  {visible.map((f) => (
                    <FoodCard key={f.id} food={f} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-5 flex justify-center pb-2">
                    <Pagination
                      current={currentPage}
                      total={foods?.length ?? 0}
                      pageSize={PAGE_SIZE}
                      onChange={setPage}
                      showSizeChanger={false}
                      aria-label="Phân trang danh sách món"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Thanh giỏ ghim đáy: tổng tiền và bước tiếp theo luôn nhìn thấy. */}
      {count > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-stone-200/70 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <p className="text-sm text-stone-600">
              <b className="font-semibold tabular-nums text-stone-900">{count} món</b>
              <span className="mx-2 text-stone-300">·</span>
              <b className="font-semibold tabular-nums text-amber-700">{formatVND(total)}</b>
            </p>
            <UiButton kind="primary-lg" onClick={() => navigate('/cart')}>
              Xem giỏ và đặt món
            </UiButton>
          </div>
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

function ComboCard({ combo }: { combo: Combo }) {
  const addCombo = useCartStore((s) => s.addCombo)
  const navigate = useNavigate()
  const price = combo.discountedPrice ?? combo.price

  return (
    <div
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:shadow-lg"
      // Cả thẻ mở chi tiết combo; nút "Thêm combo" và liên kết bên trong tự xử lý riêng.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return
        navigate(`/combos/${combo.id}`)
      }}
    >
      <Link
        to={`/combos/${combo.id}`}
        aria-label={`Xem chi tiết ${combo.name}`}
        className="relative block aspect-[16/10] overflow-hidden"
      >
        <UiImg
          src={combo.imageUrl}
          alt={combo.name}
          className="h-full w-full transition duration-300 group-hover:scale-105"
        />
        {!!combo.discountPercent && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            -{combo.discountPercent}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link to={`/combos/${combo.id}`} className="min-h-0">
          <h3 className="truncate text-sm font-semibold text-stone-900 group-hover:text-amber-700">
            {combo.name}
          </h3>
        </Link>

        <ul className="mt-1.5 space-y-0.5 text-xs leading-snug text-stone-500">
          {combo.items.map((item) => (
            <li key={item.id} className="truncate">
              {item.food.name} x{item.quantity}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-2 pt-2.5">
          <div className="min-w-0">
            <div className="text-lg font-bold tabular-nums text-amber-700">{formatVND(price)}</div>
            {price < combo.price && (
              <div className="text-xs tabular-nums text-stone-400 line-through">{formatVND(combo.price)}</div>
            )}
          </div>
          <UiButton
            kind="primary"
            className="!px-3 !text-sm"
            onClick={() => {
              void addCombo(combo)
              message.success(`Đã thêm ${combo.name} vào giỏ`)
            }}
          >
            Thêm combo
          </UiButton>
        </div>
      </div>
    </div>
  )
}
