import { ref } from 'vue'

export type AsyncActionResult<T> = { ok: true; data: T } | { ok: false; error: unknown }

/** Khoá đồng bộ ngăn hai thao tác submit diễn ra cùng lúc. */
export default function useAsyncAction<TArgs extends unknown[], T>(fn: (...args: TArgs) => Promise<T>) {
  const pending = ref(false)
  let lock = false

  const run = async (...args: TArgs): Promise<AsyncActionResult<T>> => {
    if (lock) return { ok: false, error: new Error('Đang xử lý') }
    lock = true
    pending.value = true
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error }
    } finally {
      lock = false
      pending.value = false
    }
  }

  return { run, pending }
}
