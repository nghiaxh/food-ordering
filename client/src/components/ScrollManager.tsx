import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const HEADER_OFFSET = 64

function scrollToHash(hash: string): void {
  const id = decodeURIComponent(hash.slice(1))
  if (!id) return
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  let remaining = 20
  const attempt = () => {
    const el = document.getElementById(id)
    if (el) {
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET)
      window.scrollTo({ top, behavior })
      return
    }
    if (remaining-- > 0) window.setTimeout(attempt, 100)
  }
  attempt()
}

export default function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      scrollToHash(location.hash)
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [location.pathname, location.hash])

  return null
}