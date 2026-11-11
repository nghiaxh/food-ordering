import { onUnmounted, ref, watch, type Ref } from 'vue'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isCanceled = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'ERR_CANCELED'

const isNetworkError = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && !('response' in e) && !isCanceled(e)

interface UseAsyncDataOptions {
  retries?: number
}

/**
 * Tai du lieu co huy request cu khi dependencies doi (watch sau) va chi retry loi mang.
 * Moi lan chay tang sequence de response cu khong ghi de du lieu moi hon.
 */
export default function useAsyncData<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: () => unknown[],
  options: UseAsyncDataOptions = {},
) {
  const { retries = 2 } = options
  const data = ref<T>() as Ref<T | undefined>
  const loading = ref(true)
  const error = ref<unknown>(null)
  let seq = 0
  let controller: AbortController | null = null

  const run = async () => {
    const current = ++seq
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = null
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await fn(controller.signal)
        if (current !== seq) return
        data.value = result
        loading.value = false
        return
      } catch (e) {
        if (current !== seq || isCanceled(e)) return
        if (attempt < retries && isNetworkError(e)) {
          await sleep(300 * (attempt + 1))
          if (current === seq) continue
          return
        }
        error.value = e
        loading.value = false
        return
      }
    }
  }

  watch(deps, run, { immediate: true, deep: true })

  onUnmounted(() => {
    seq += 1
    controller?.abort()
  })

  const refresh = () => run()
  return { data, loading, error, refresh }
}
