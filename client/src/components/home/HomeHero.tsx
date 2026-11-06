import UiButton from '../UiButton'
import UiIcon from '../UiIcon'
import UiImg from '../UiImg'

interface HomeHeroProps {
  foodCount: number
  categoryCount: number
  onBrowse: () => void
  onAsk: () => void
}

/**
 * Khối mở đầu của thực đơn. Chỉ hiện khi chưa có bộ lọc để không đẩy lưới món xuống quá sâu.
 * Ảnh dùng lại `hero.webp` có sẵn, ẩn dưới `sm` vì màn hẹp cần chỗ cho hai nút.
 */
export default function HomeHero({ foodCount, categoryCount, onBrowse, onAsk }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100/70 ring-1 ring-amber-100">
      <div className="flex items-center justify-between gap-4 p-4 sm:p-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
            <UiIcon name="map-marker" size={12} />
            Cần Thơ · giao 20-30 phút
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-3xl">
            Món Việt nóng hổi,
            <br className="hidden sm:block" /> giao tận cửa
          </h1>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
            {foodCount} món · {categoryCount} danh mục. Trợ lý AI gợi ý theo khẩu vị, ngân sách và số người ăn.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <UiButton kind="primary" onClick={onBrowse}>
              Xem thực đơn
            </UiButton>
            <UiButton kind="default" icon={<UiIcon name="message" size={16} />} onClick={onAsk}>
              Hỏi trợ lý AI
            </UiButton>
          </div>
        </div>
        <UiImg
          src="/images/hero.webp"
          alt=""
          className="hidden h-32 w-48 shrink-0 rounded-2xl shadow-sm sm:block lg:h-36 lg:w-64"
        />
      </div>
    </section>
  )
}
