import { useEffect, useMemo, useRef, useState } from 'react'
import { Dropdown, Empty, message } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import type { Food } from '../types'
import FoodCard from '../components/FoodCard'
import UiButton from '../components/UiButton'
import UiIcon from '../components/UiIcon'
import HomeHero from '../components/home/HomeHero'
import CategoryRail from '../components/home/CategoryRail'
import DealRail from '../components/home/DealRail'

/** Số món mỗi lượt. 12 chia hết cho 2 và 4 cột nên không lượt nào lẻ hàng. */
const PAGE_SIZE = 12

/** 2 cột trên mobile, 4 cột từ `md`, giữ đúng mật độ hiện tại. */
const GRID_COLS = 'grid-cols-2 md:grid-cols-4'

const MENU_SCROLL_KEY = 'menu-scroll'

/** Khoảng giá dạng sẵn dễ chạm hơn hai ô nhập số, vẫn là "lọc khoảng giá" của Bảng 2.22. */
const PRICE_BANDS = [
  { label: 'Mọi giá', min: undefined, max: undefined },
  { label: 'Dưới 50k', min: undefined, max: 50000 },
  { label: '50 – 100k', min: 50000, max: 100000 },
  { label: '100 – 150k', min: 100000, max: 150000 },
  { label: 'Trên 150k', min: 150000, max: undefined },
]

const SORTS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'price-asc', label: 'Giá thấp đến cao' },
  { value: 'price-desc', label: 'Giá cao đến thấp' },
  { value: 'discount', label: 'Giảm nhiều nhất' },
]

function num(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function priceOf(food: Food): number {
  return food.discountedPrice ?? food.price
}

function hasDietTag(food: Food, tag: string): boolean {
  return food.dietaryTags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .includes(tag)
}

/**
 * Trang chủ kiểu kiosk: hero ngắn, danh mục có ảnh, ưu đãi thật từ server, rồi mới tới
 * thực đơn. Bộ lọc nằm trên URL nên chia sẻ được và nút quay lại không mất trạng thái.
 *
 * Server lọc theo danh mục, khoảng giá và từ khóa; các bộ lọc nhanh còn lại (chay, không cay,
 * còn món, đang giảm) lọc trên danh sách đã tải vì dữ liệu đã có đủ trong từng món.
 */
export default function FoodsPage() {
  const [params, setParams] = useSearchParams()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const categoryId = num(params.get('category'))
  const keyword = params.get('keyword') ?? undefined
  const minPrice = num(params.get('min'))
  const maxPrice = num(params.get('max'))
  const sort = params.get('sort') ?? 'default'
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? 'Mặc định'
  const diet = params.get('diet') ?? undefined
  const noSpicy = params.get('spicy') === '0'
  const onlyAvailable = params.get('available') === '1'
  const onlyDeals = params.get('deal') === '1'

  const itemCount = useCartStore((s) => s.items.length)
  const portionCount = useCartStore((s) => s.count())
  const openDrawer = useUiStore((s) => s.openDrawer)
  const openChat = useUiStore((s) => s.openChat)

  const { data: categories } = useAsyncData((signal) => getCategories(signal), [])
  const {
    data: foods,
    loading,
    error,
    refresh,
  } = useAsyncData(
    (signal) => getFoods({ categoryId, keyword, minPrice, maxPrice }, signal),
    [categoryId, keyword, minPrice, maxPrice],
  )

  useEffect(() => {
    if (error) message.error('Không tải được thực đơn')
  }, [error])

  const patch = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) merged.delete(key)
      else merged.set(key, value)
    }
    setParams(merged)
  }

  const clearFilters = () => setParams(new URLSearchParams())

  const filtersActive = Boolean(
    categoryId !== undefined ||
      keyword ||
      minPrice !== undefined ||
      maxPrice !== undefined ||
      sort !== 'default' ||
      diet ||
      noSpicy ||
      onlyAvailable ||
      onlyDeals,
  )

  const pickCategory = (id?: number) => {
    patch({ category: id?.toString() })
    document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filtered = useMemo(() => {
    let list = foods ?? []
    if (diet) list = list.filter((f) => hasDietTag(f, diet))
    if (noSpicy) list = list.filter((f) => f.spicyLevel === 0)
    if (onlyAvailable) list = list.filter((f) => f.available)
    if (onlyDeals) list = list.filter((f) => (f.discountPercent ?? 0) > 0)

    const sorted = [...list]
    if (sort === 'price-asc') sorted.sort((a, b) => priceOf(a) - priceOf(b))
    else if (sort === 'price-desc') sorted.sort((a, b) => priceOf(b) - priceOf(a))
    else if (sort === 'discount') {
      sorted.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
    }
    return sorted
  }, [foods, diet, noSpicy, onlyAvailable, onlyDeals, sort])

  // Đổi bộ lọc thì quay về lượt đầu, tránh đang ở "Tải thêm" mà danh sách ngắn lại.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [categoryId, keyword, minPrice, maxPrice, sort, diet, noSpicy, onlyAvailable, onlyDeals])

  // Quay lại từ trang chi tiết: trả đúng vị trí cuộn của bảng món sau khi dữ liệu đã về.
  useEffect(() => {
    if (loading || !foods) return
    const saved = sessionStorage.getItem(MENU_SCROLL_KEY)
    const scroller = scrollerRef.current
    if (!saved || !scroller) return
    sessionStorage.removeItem(MENU_SCROLL_KEY)
    const top = Number(saved)
    if (Number.isFinite(top)) requestAnimationFrame(() => scroller.scrollTo({ top }))
  }, [loading, foods])

  const visible = filtered.slice(0, visibleCount)
  const deals = (foods ?? []).filter((f) => (f.discountPercent ?? 0) > 0).slice(0, 8)
  const activePriceBand = PRICE_BANDS.findIndex((b) => b.min === minPrice && b.max === maxPrice)
  const from = `/${params.toString() ? `?${params.toString()}` : ''}`

  const chipClass = (active: boolean) =>
    `inline-flex min-h-8 cursor-pointer items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
      active
        ? 'bg-amber-700 text-white'
        : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  return (
    <div
      ref={scrollerRef}
      className="kiosk-scroll h-[calc(100dvh-var(--header-h))] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
    >
      {/* Hero trải hết bề ngang vùng cuộn; phần còn lại vẫn bó trong 1600px. */}
      {!filtersActive && (
        <HomeHero
          foodCount={foods?.length ?? 0}
          onBrowse={() =>
            document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          onAsk={openChat}
        />
      )}

      <div className="mx-auto max-w-[1600px] px-3 pb-4 sm:px-6">
        <div className="mt-3 sm:mt-4">
          <CategoryRail categories={categories ?? []} activeId={categoryId} onPick={pickCategory} />
        </div>

        {deals.length > 0 && !onlyDeals && (
          <div className="mt-4 sm:mt-5">
            <DealRail foods={deals} from={from} onSeeAll={() => patch({ deal: '1' })} />
          </div>
        )}

        <section id="thuc-don" className="scroll-mt-2 pt-4 sm:pt-5">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold tracking-tight text-stone-900">
              {keyword ? `Kết quả cho “${keyword}”` : 'Thực đơn'}
              <span className="ml-2 text-sm font-normal text-stone-500">{filtered.length} món</span>
            </h2>
            <div className="flex shrink-0 items-center gap-3">
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-amber-800 hover:underline"
                >
                  Xóa bộ lọc
                </button>
              )}
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: SORTS.map((s) => ({ key: s.value, label: s.label })),
                  selectable: true,
                  selectedKeys: [sort],
                  onClick: ({ key }) => patch({ sort: key === 'default' ? undefined : key }),
                }}
              >
                <button
                  type="button"
                  aria-label={`Sắp xếp thực đơn, đang chọn ${sortLabel}`}
                  className="-mr-1 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                >
                  Sắp xếp: {sortLabel}
                  <DownOutlined style={{ fontSize: 9 }} />
                </button>
              </Dropdown>
            </div>
          </div>

          <div className="sticky top-0 z-10 -mx-3 mt-2 border-b border-stone-200/70 bg-stone-50/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <button
                type="button"
                className={chipClass(onlyAvailable)}
                onClick={() => patch({ available: onlyAvailable ? undefined : '1' })}
              >
                Còn món
              </button>
              <button
                type="button"
                className={chipClass(diet === 'chay')}
                onClick={() => patch({ diet: diet === 'chay' ? undefined : 'chay' })}
              >
                Món chay
              </button>
              <button
                type="button"
                className={chipClass(noSpicy)}
                onClick={() => patch({ spicy: noSpicy ? undefined : '0' })}
              >
                Không cay
              </button>
              <button
                type="button"
                className={chipClass(onlyDeals)}
                onClick={() => patch({ deal: onlyDeals ? undefined : '1' })}
              >
                Đang giảm
              </button>
              <span className="mx-1 hidden w-px self-stretch bg-stone-200 sm:block" />
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
                  className={chipClass(activePriceBand === i)}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            {error ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
                <UiIcon name="exclamation-circle" size={26} className="text-stone-300" />
                <p className="mt-3 font-medium text-stone-900">Không tải được thực đơn</p>
                <p className="mt-1 text-sm text-stone-500">Kiểm tra kết nối rồi thử lại.</p>
                <UiButton kind="default" className="mt-4" onClick={() => void refresh()}>
                  Thử lại
                </UiButton>
              </div>
            ) : loading ? (
              <div className={`grid gap-3 ${GRID_COLS}`}>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/60">
                    <div className="aspect-[16/10] animate-pulse bg-stone-200/70" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-stone-200/70" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-stone-200/70" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Empty description="Không tìm thấy món phù hợp">
                <div className="flex flex-wrap justify-center gap-2">
                  {filtersActive && (
                    <UiButton kind="default" onClick={clearFilters}>
                      Xóa bộ lọc
                    </UiButton>
                  )}
                  <UiButton
                    kind="primary"
                    icon={<UiIcon name="message" size={16} />}
                    onClick={openChat}
                  >
                    Hỏi trợ lý AI
                  </UiButton>
                </div>
              </Empty>
            ) : (
              <>
                <div className={`grid gap-3 ${GRID_COLS}`}>
                  {visible.map((food) => (
                    <FoodCard key={food.id} food={food} />
                  ))}
                </div>
                {visible.length < filtered.length && (
                  <div className="mt-5 flex flex-col items-center gap-1.5 pb-2">
                    <UiButton kind="default" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                      Tải thêm món
                    </UiButton>
                    <span className="text-xs text-stone-500">
                      Đã hiện {visible.length}/{filtered.length} món
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Thanh giỏ ghim đáy: mở drawer, không rời trang chủ. */}
      {portionCount > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-stone-200/70 bg-white px-4 py-2.5">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
            <p className="min-w-0 text-sm text-stone-600">
              <b className="font-semibold text-stone-900">{itemCount} món</b>
              <span className="mx-1.5 text-stone-400">·</span>
              <span className="tabular-nums">{portionCount} phần</span>
            </p>
            <UiButton kind="primary" onClick={() => openDrawer('cart')}>
              Xem giỏ
            </UiButton>
          </div>
        </div>
      )}
    </div>
  )
}
