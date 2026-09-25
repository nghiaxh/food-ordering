import { useCallback, useEffect, useRef, useState } from 'react'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isCanceled(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'ERR_CANCELED'
  )
}

function isNetworkError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && !('response' in e) && !isCanceled(e)
}

interface UseAsyncDataOptions {
  retries?: number
}

export default function useAsyncData<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: UseAsyncDataOptions = {},
) {
  const { retries = 2 } = options
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  // Mỗi lần chạy tăng sequence để response cũ không ghi đè dữ liệu mới hơn.
  const seqRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(() => {
    const seq = ++seqRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError(null)
    void (async () => {
      // Chỉ retry lỗi mạng; lỗi HTTP không tự động thử lại.
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await fnRef.current(controller.signal)
          if (seq !== seqRef.current) return
          setData(result)
          setLoading(false)
          return
        } catch (e) {
          if (seq !== seqRef.current || isCanceled(e)) return
          if (attempt < retries && isNetworkError(e)) {
            await sleep(300 * (attempt + 1))
            if (seq === seqRef.current) continue
            return
          }
          setError(e)
          setLoading(false)
          return
        }
      }
    })()
  }, [retries])

  useEffect(() => {
    void run()
    return () => {
      // Khi component unmount hoặc deps đổi, vô hiệu hóa request cũ trước khi chạy request mới.
      seqRef.current += 1
      controllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refresh: run }
}