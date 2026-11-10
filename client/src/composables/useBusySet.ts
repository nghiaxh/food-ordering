import { ref, computed } from 'vue'

/** Đánh dấu các dòng đang xử lý (xóa, đổi trạng thái...) để hiển thị loading riêng từng dòng. */
export default function useBusySet() {
  const busyIds = ref(new Set<number>())
  const mark = (id: number, value: boolean) => {
    const next = new Set(busyIds.value)
    if (value) next.add(id)
    else next.delete(id)
    busyIds.value = next
  }
  const has = (id: number) => busyIds.value.has(id)
  return { busyIds: computed(() => busyIds.value), has, mark }
}
