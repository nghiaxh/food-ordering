import { useEffect, useState } from 'react'

/**
 * Theo dõi một media query bằng JS thay vì ẩn/hiện bằng class. Header cần biết bề rộng
 * thật để quyết định đưa nút vào menu tài khoản hay hiện riêng; ẩn bằng class sẽ để lại
 * khoảng trống trong menu và phụ thuộc thứ tự nạp CSS của AntD.
 */
export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
