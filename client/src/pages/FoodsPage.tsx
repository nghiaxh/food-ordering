import { useEffect, useMemo, useState } from 'react'
import { Empty, Pagination, message } from 'antd'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { getCategories, getFoods } from '../api/api'
import useAsyncData from '../hooks/useAsyncData'
import { useCartStore } from '../store/cartStore'
import { formatVND } from '../utils/format'
import FoodCard from '../components/FoodCard'
import UiButton from '../components/UiButton'

/** Số món mỗi trang. Thực đơn hiện vài chục món nên phân trang phía client là đủ. */
const PAGE_SIZE = 12

/**
 * Khoảng giá dạng sẵn dễ chạm hơn hai ô nhập số, vẫn là "lọc khoảng giá" của Bảng 2.22.
 * Mục đầu ghi "Mọi giá" chứ không phải "Tất cả" vì dải danh mục ngay dưới đã có "Tất cả",
 * hai chữ giống nhau cạnh nhau dễ bị hiểu là cùng một bộ lọc.
 */
const PRICE_BANDS = [
  { label: 'Mọi giá', min: undefined, max: undefined },
  { label: 'Dưới 50k', min: undefined, max: 50000 },
  { label: '50 – 100k', min: 50000, max: 100000 },
  { label: '100 – 150k', min: 100000, max: 150000 },
  { label: 'Trên 150k', min: 150000, max: undefined },
]

function num(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Bảng món kiểu kiosk: rail danh mục cố định bên trái, lưới thẻ món cuộn trong vùng riêng,
 * thanh giỏ ghim đáy. Toàn bộ bộ lọc nằm trên URL nên người dùng chia sẻ được đường dẫn
 * và nút quay lại của trình duyệt không mất trạng thái đang xem.
 */
export default function FoodsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)

  const categoryId = num(params.get('category'))
  const keyword = params.get('keyword') ?? undefined
  const minPrice = num(params.get('min'))
  const maxPrice = num(params.get('max'))

  const count = useCartStore((s) => s.count())
  const total = useCartStore((s) => s.total())

  const { data: categories } = useAsyncData((signal) => getCategories(signal), [])
  const { data: foods, loading, error } = useAsyncData(
    (signal) => getFoods({ categoryId, keyword, minPrice, maxPrice }, signal),
    [categoryId, keyword, minPrice, maxPrice],
  )

  useEffect(() => {
    if (error) message.error('Không tải được thực đơn')
  }, [error])

  // Lọc mới có thể làm trang đang xem vượt quá giới hạn.
  const totalPages = Math.max(1, Math.ceil((foods?.length ?? 0) / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [page, currentPage])

  const visible = useMemo(
    () => (foods ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [foods, currentPage],
  )

  const patch = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) merged.delete(key)
      else merged.set(key, value)
    }
    setParams(merged)
    setPage(1)
  }

  const activePriceBand = PRICE_BANDS.findIndex((b) => b.min === minPrice && b.max === maxPrice)
  const categoryList = [
    { id: undefined as number | undefined, name: 'Tất cả', slug: 'tat-ca' },
    ...(categories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  ]

  const railBtn = (active: boolean) =>
    `block w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
      active ? 'bg-amber-600 text-white' : 'text-stone-700 hover:bg-amber-50 hover:text-amber-700'
    }`

  const chipBtn = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition sm:px-4 sm:py-2.5 sm:text-sm ${
      active ? 'bg-amber-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
    }`

  /** Số cột đổi theo bề rộng; `lg` có rail nên phải bớt cột lại so với mức không có rail. */
  const gridCols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Rail danh mục, chỉ hiện khi đủ rộng. Không nhãn: danh sách đã tự nói là danh mục. */}
        <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-stone-200/70 bg-white/60 p-2 lg:block">
          <nav className="space-y-0.5">
            {categoryList.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-current={categoryId === c.id ? 'true' : undefined}
                onClick={() => patch({ category: c.id?.toString() })}
                className={railBtn(categoryId === c.id)}
              >
                {c.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* Dải khoảng giá dính đầu vùng lưới thay vì nằm ở một hàng riêng phía trên:
              tiết kiệm nguyên chiều cao hàng đó mà vẫn luôn nằm trong tầm mắt. */}
          <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-stone-200/70 bg-stone-50/95 px-3 py-2 backdrop-blur sm:px-4">
            {PRICE_BANDS.map((band, i) => (
              <button
                key={band.label}
                type="button"
                onClick={() => patch({ min: band.min?.toString(), max: band.max?.toString() })}
                className={chipBtn(activePriceBand === i)}
              >
                {band.label}
              </button>
            ))}
          </div>

          <div className="px-3 py-3 sm:px-4">
            {/* Màn hình nhỏ không có rail nên danh mục chuyển thành dải chip cuộn ngang. */}
            <div className="mb-3 flex gap-2 overflow-x-auto lg:hidden">
              {categoryList.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  aria-current={categoryId === c.id ? 'true' : undefined}
                  onClick={() => patch({ category: c.id?.toString() })}
                  className={chipBtn(categoryId === c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className={`grid gap-3 ${gridCols}`}>
                {Array.from({ length: 9 }).map((_, i) => (
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
                <div className={`grid gap-3 ${gridCols}`}>
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
        </div>
      </div>

      {/* Thanh giỏ ghim đáy: tổng tiền và bước tiếp theo luôn nhìn thấy. */}
      {count > 0 && (
        <div className="shrink-0 border-t border-stone-200/70 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <p className="text-sm text-stone-600">
              <b className="font-semibold tabular-nums text-stone-900">{count} món</b>
              <span className="mx-2 text-stone-300">·</span>
              <b className="font-semibold tabular-nums text-amber-700">{formatVND(total)}</b>
            </p>
            <UiButton
              kind="primary-lg"
              onClick={() => navigate('/cart')}
              disabled={false}
            >
              Xem giỏ và đặt món
            </UiButton>
          </div>
        </div>
      )}

      {/* Route con /foods/:id hiện thành panel phủ nên có thể render ở đây. */}
      <Outlet />
    </div>
  )
}