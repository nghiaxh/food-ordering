import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useHasCartBar } from '../hooks/useCartBar'

/**
 * Nút cuộn lên đầu trang. Chỉ hiện khi đã cuộn quá 400px, ẩn ngay khi bấm và
 * không hiện trong lúc chatbot đang mở để không đè lên khung chat. Nút đứng
 * ngay phía trên launcher chatbot (nút 80px tính từ bottom-5).
 */
export default function ScrollTopButton({ blocked = false }: { blocked?: boolean }) {
  const { pathname } = useLocation()
  const hasCartBar = useHasCartBar()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Đổi trang thì vị trí cuộn được ScrollManager đưa về đầu, nút cũng phải ẩn theo.
  useEffect(() => setVisible(false), [pathname])

  if (blocked || !visible) return null

  const isAdmin = pathname.startsWith('/admin')
  const bottom = isAdmin ? 'bottom-5' : hasCartBar ? 'bottom-28' : 'bottom-26'

  return (
    <button
      type="button"
      aria-label="Về đầu trang"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }
      className={`fixed right-5 z-40 grid h-10 w-10 place-items-center rounded-full bg-white text-stone-600 shadow-lg shadow-stone-900/10 ring-1 ring-stone-200 transition hover:bg-amber-50 hover:text-amber-700 ${bottom}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
