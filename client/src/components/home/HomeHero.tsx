import UiButton from '../UiButton'

interface HomeHeroProps {
  onBrowse: () => void
  onAsk: () => void
}

/**
 * Banner mở đầu thực đơn, trải hết bề ngang vùng cuộn. Chỉ hiện khi chưa có bộ lọc để
 * không đẩy lưới món xuống quá sâu. Nội dung chỉ nói địa bàn và thời gian giao thật; ảnh là
 * ảnh món thật của quán nên chỉ phủ một lớp tối vừa đủ để chữ trắng đạt tương phản.
 */
export default function HomeHero({ onBrowse, onAsk }: HomeHeroProps) {
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
        <h1 className="max-w-lg text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
          Hôm nay ăn gì?
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
