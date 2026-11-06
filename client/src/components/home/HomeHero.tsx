import UiButton from '../UiButton'

interface HomeHeroProps {
  foodCount: number
  onBrowse: () => void
  onAsk: () => void
}

/**
 * Banner mở đầu thực đơn, trải hết bề ngang vùng cuộn. Chỉ hiện khi chưa có bộ lọc để
 * không đẩy lưới món xuống quá sâu. Nội dung nói đúng thứ đang có (địa bàn, số món thật)
 * thay vì khẩu hiệu; ảnh là ảnh món thật của quán nên chỉ phủ một lớp tối vừa đủ để chữ
 * trắng đạt tương phản, không dùng gradient trang trí.
 */
export default function HomeHero({ foodCount, onBrowse, onAsk }: HomeHeroProps) {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src="/images/hero.webp"
        alt=""
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[58%_45%]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/10" />

      <div className="relative mx-auto flex h-[180px] max-w-[1600px] flex-col justify-center px-4 sm:h-[220px] sm:px-6 lg:h-[260px]">
        <p className="text-xs font-medium text-amber-100">Cần Thơ · giao 20-30 phút</p>
        <h1 className="mt-1.5 max-w-lg text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
          {foodCount > 0 ? `${foodCount} món cho hôm nay` : 'Thực đơn hôm nay'}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <UiButton kind="primary" onClick={onBrowse}>
            Xem thực đơn
          </UiButton>
          <button
            type="button"
            onClick={onAsk}
            className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-white/90 underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
          >
            Hỏi trợ lý AI
          </button>
        </div>
      </div>
    </section>
  )
}
