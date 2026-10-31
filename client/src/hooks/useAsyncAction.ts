import { useCallback, useRef, useState } from 'react'

export type AsyncActionResult<T> = { ok: true; data: T } | { ok: false; error: unknown }

export default function useAsyncAction<TArgs extends unknown[], T>(
  fn: (...args: TArgs) => Promise<T>,
) {
  const [pending, setPending] = useState(false)
  const lockRef = useRef(false)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (...args: TArgs): Promise<AsyncActionResult<T>> => {
    if (lockRef.current) return { ok: false, error: new Error('Đang xử lý') }
    lockRef.current = true
    setPending(true)
    try {
      const data = await fnRef.current(...args)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error }
    } finally {
      lockRef.current = false
      setPending(false)
    }
  }, [])

  return { run, pending }
}