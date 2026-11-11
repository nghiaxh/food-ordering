import { ref, computed } from 'vue'

/** Danh dau cac dong dang xu ly (xoa, doi trang thai...) de hien thi loading rieng tung dong. */
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
