<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NDropdown, NEmpty, NIcon } from 'naive-ui'
import { AlertCircleOutline, ChevronDown } from '@vicons/ionicons5'
import { getCategories, getFoods } from '@/user/menu/api'
import useAsyncData from '@/composables/useAsyncData'
import { useUiStore } from '@/shared/stores/uiStore'
import type { Food } from '@/shared/types'
import FoodCard from '@/user/menu/components/FoodCard.vue'
import HomeHero from '@/user/menu/components/HomeHero.vue'
import CategoryRail from '@/user/menu/components/CategoryRail.vue'
import DealRail from '@/user/menu/components/DealRail.vue'
import { message } from '@/shared/api/message'

/** So mon moi luot. 12 chia het cho 2 va 4 cot nen khong luot nao le hang. */
const PAGE_SIZE = 12
/** 2 cot tren mobile, 4 cot tu `md`, giu dung mat do hien tai. */
const GRID_COLS = 'grid-cols-2 md:grid-cols-4'
const MENU_SCROLL_KEY = 'menu-scroll'

/** Khoang gia dang san de cham hon hai o nhap so. */
const PRICE_BANDS = [
  { label: 'Mọi giá', min: undefined, max: undefined },
  { label: 'Dưới 50k', min: undefined, max: 50000 },
  { label: '50 – 100k', min: 50000, max: 100000 },
  { label: '100 – 150k', min: 100000, max: 150000 },
  { label: 'Trên 150k', min: 150000, max: undefined },
]

const SORTS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'price-asc', label: 'Giá thấp đến cao' },
  { value: 'price-desc', label: 'Giá cao đến thấp' },
  { value: 'discount', label: 'Giảm nhiều nhất' },
]

const num = (value: unknown): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}
const str = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw == null || raw === '' ? undefined : String(raw)
}

const priceOf = (food: Food) => food.discountedPrice ?? food.price
const hasDietTag = (food: Food, tag: string) =>
  food.dietaryTags?.split(',').map((t) => t.trim().toLowerCase()).includes(tag) ?? false

const route = useRoute()
const router = useRouter()
const scroller = ref<HTMLElement | null>(null)
const ui = useUiStore()

// Bo loc nam tren URL nen chia se duoc va nut quay lai khong mat trang thai.
const categoryId = computed(() => num(route.query.category))
const keyword = computed(() => str(route.query.keyword))
const minPrice = computed(() => num(route.query.min))
const maxPrice = computed(() => num(route.query.max))
const pageParam = computed(() => num(route.query.page))
const sort = computed(() => str(route.query.sort) ?? 'default')
const sortLabel = computed(() => SORTS.find((s) => s.value === sort.value)?.label ?? 'Mặc định')
const diet = computed(() => str(route.query.diet))
const noSpicy = computed(() => str(route.query.spicy) === '0')
const onlyAvailable = computed(() => str(route.query.available) === '1')
const onlyDeals = computed(() => str(route.query.deal) === '1')

const { data: categories } = useAsyncData((signal) => getCategories(signal), () => [])
const {
  data: foods,
  loading,
  error,
  refresh,
} = useAsyncData(
  (signal) => getFoods({ categoryId: categoryId.value, keyword: keyword.value, minPrice: minPrice.value, maxPrice: maxPrice.value }, signal),
  () => [categoryId.value, keyword.value, minPrice.value, maxPrice.value],
)

watch(error, (e) => {
  if (e) message.error('Không tải được thực đơn')
})

// Sua query giu nguyen cac param khac (keyword do header dieu khien, page, ...).
const patch = (next: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    const raw = Array.isArray(value) ? value[0] : value
    if (raw != null) params.set(key, String(raw))
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) params.delete(key)
    else params.set(key, value)
  }
  router.replace({ query: Object.fromEntries(params) })
}
const clearFilters = () => router.replace({ query: {} })

const filtersActive = computed(() =>
  Boolean(
    categoryId.value !== undefined || keyword.value || minPrice.value !== undefined || maxPrice.value !== undefined ||
      sort.value !== 'default' || diet.value || noSpicy.value || onlyAvailable.value || onlyDeals.value,
  ),
)

const pickCategory = (id?: number) => {
  patch({ category: id?.toString() })
  document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToMenu = () => document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const filtered = computed(() => {
  let list = foods.value ?? []
  if (diet.value) list = list.filter((f) => hasDietTag(f, diet.value!))
  if (noSpicy.value) list = list.filter((f) => f.spicyLevel === 0)
  if (onlyAvailable.value) list = list.filter((f) => f.available)
  if (onlyDeals.value) list = list.filter((f) => (f.discountPercent ?? 0) > 0)

  const sorted = [...list]
  if (sort.value === 'price-asc') sorted.sort((a, b) => priceOf(a) - priceOf(b))
  else if (sort.value === 'price-desc') sorted.sort((a, b) => priceOf(b) - priceOf(a))
  else if (sort.value === 'discount') sorted.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
  return sorted
})

// Doi bo loc thi ve trang dau, tranh dang o trang 3 ma danh sach ngan lai.
watch(
  [categoryId, keyword, minPrice, maxPrice, sort, diet, noSpicy, onlyAvailable, onlyDeals],
  () => {
    if (route.query.page !== undefined) patch({ page: undefined })
  },
)

// Quay lai tu trang chi tiet: tra dung vi tri cuon cua bang mon sau khi du lieu da ve.
watch([loading, foods], ([isLoading]) => {
  if (isLoading || !foods.value) return
  const saved = sessionStorage.getItem(MENU_SCROLL_KEY)
  if (!saved || !scroller.value) return
  sessionStorage.removeItem(MENU_SCROLL_KEY)
  const top = Number(saved)
  if (Number.isFinite(top)) requestAnimationFrame(() => scroller.value?.scrollTo({ top }))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(Math.max(1, pageParam.value ?? 1), pageCount.value))
const visible = computed(() =>
  filtered.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE),
)
const deals = computed(() => (foods.value ?? []).filter((f) => (f.discountPercent ?? 0) > 0).slice(0, 8))
const activePriceBand = computed(() => PRICE_BANDS.findIndex((b) => b.min === minPrice.value && b.max === maxPrice.value))

const chipClass = (active: boolean) =>
  `inline-flex min-h-10 cursor-pointer items-center whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
    active ? 'bg-amber-700 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
  }`

const goToPage = (next: number) => {
  const target = Math.min(Math.max(1, next), pageCount.value)
  patch({ page: target === 1 ? undefined : target.toString() })
  document.getElementById('thuc-don')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Danh sach trang gon: du it thi hien het, nhieu thi rut gon quanh trang hien tai.
const pageItems = computed<Array<number | '…'>>(() => {
  if (pageCount.value <= 7) return Array.from({ length: pageCount.value }, (_, i) => i + 1)
  const around = new Set([1, currentPage.value - 1, currentPage.value, currentPage.value + 1, pageCount.value])
  const sorted = [...around].filter((n) => n >= 1 && n <= pageCount.value).sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push('…')
    out.push(sorted[i]!)
  }
  return out
})
const pageButtonClass = (active: boolean) =>
  `inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-full px-2 text-sm tabular-nums transition ${
    active ? 'bg-amber-700 font-semibold text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-amber-50'
  }`

const sortOptions = SORTS.map((s) => ({ key: s.value, label: s.label }))
const onSort = (key: string | number) => patch({ sort: key === 'default' ? undefined : String(key) })
const askAi = () => ui.openChat()
</script>

<template>
  <!-- Trang chu kieu kiosk: hero ngan, danh muc co anh, uu dai that, roi toi thuc don. -->
  <div ref="scroller" class="kiosk-scroll h-[calc(100dvh-var(--header-h))] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
    <HomeHero v-if="!filtersActive" :on-ask="askAi" :on-browse="scrollToMenu" />

    <div class="mx-auto max-w-[1600px] px-3 pb-4 sm:px-6">
      <div class="mt-3 sm:mt-4">
        <CategoryRail :categories="categories ?? []" :active-id="categoryId" @pick="pickCategory" />
      </div>

      <div v-if="deals.length > 0 && !onlyDeals" class="mt-4 sm:mt-5">
        <DealRail :foods="deals" @see-all="patch({ deal: '1' })" />
      </div>

      <section id="thuc-don" class="scroll-mt-2 pt-4 sm:pt-5">
        <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <h2 class="text-lg font-bold tracking-tight text-stone-900">
            {{ keyword ? `Kết quả cho “${keyword}”` : 'Thực đơn' }}
            <span class="ml-2 text-sm font-normal text-stone-500">{{ filtered.length }} món</span>
          </h2>
          <div class="flex shrink-0 items-center gap-3">
            <button v-if="filtersActive" type="button" class="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-amber-800 hover:underline" @click="clearFilters">
              Xóa bộ lọc
            </button>
            <NDropdown trigger="click" placement="bottom-end" :options="sortOptions" @select="onSort">
              <button
                type="button"
                :aria-label="`Sắp xếp thực đơn, đang chọn ${sortLabel}`"
                class="-mr-1 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                Sắp xếp: {{ sortLabel }}
                <NIcon :size="9"><ChevronDown /></NIcon>
              </button>
            </NDropdown>
          </div>
        </div>

        <div class="sticky top-0 z-10 -mx-3 mt-2 border-b border-stone-200/70 bg-stone-50/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <div class="flex min-w-0 flex-wrap gap-1.5">
            <button type="button" :class="chipClass(onlyAvailable)" @click="patch({ available: onlyAvailable ? undefined : '1' })">Còn món</button>
            <button type="button" :class="chipClass(diet === 'chay')" @click="patch({ diet: diet === 'chay' ? undefined : 'chay' })">Món chay</button>
            <button type="button" :class="chipClass(noSpicy)" @click="patch({ spicy: noSpicy ? undefined : '0' })">Không cay</button>
            <button type="button" :class="chipClass(onlyDeals)" @click="patch({ deal: onlyDeals ? undefined : '1' })">Đang giảm</button>
            <span class="mx-1 hidden w-px self-stretch bg-stone-200 sm:block" />
            <button
              v-for="(band, i) in PRICE_BANDS"
              :key="band.label"
              type="button"
              :class="chipClass(activePriceBand === i)"
              @click="patch({ min: band.min?.toString(), max: band.max?.toString() })"
            >
              {{ band.label }}
            </button>
          </div>
        </div>

        <div class="mt-3">
          <div v-if="error" class="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
            <NIcon :size="26" class="text-stone-300"><AlertCircleOutline /></NIcon>
            <p class="mt-3 font-medium text-stone-900">Không tải được thực đơn</p>
            <p class="mt-1 text-sm text-stone-500">Kiểm tra kết nối rồi thử lại.</p>
            <NButton class="mt-4" @click="refresh()">Thử lại</NButton>
          </div>

          <div v-else-if="loading" class="grid gap-3" :class="GRID_COLS">
            <div v-for="i in PAGE_SIZE" :key="i" class="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/60">
              <div class="aspect-[16/10] animate-pulse bg-stone-200/70" />
              <div class="space-y-2 p-3">
                <div class="h-4 w-2/3 animate-pulse rounded-full bg-stone-200/70" />
                <div class="h-3 w-full animate-pulse rounded-full bg-stone-200/70" />
              </div>
            </div>
          </div>

          <NEmpty v-else-if="filtered.length === 0" description="Không tìm thấy món phù hợp">
            <template #extra>
              <div class="flex flex-wrap justify-center gap-2">
                <NButton v-if="filtersActive" @click="clearFilters">Xóa bộ lọc</NButton>
                <NButton type="primary" @click="askAi">Hỏi trợ lý AI</NButton>
              </div>
            </template>
          </NEmpty>

          <template v-else>
            <div class="grid gap-3" :class="GRID_COLS">
              <FoodCard v-for="food in visible" :key="food.id" :food="food" />
            </div>
            <div v-if="pageCount > 1" class="mt-5 flex flex-col items-center gap-2 pb-2">
              <nav class="flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang thực đơn">
                <button type="button" :disabled="currentPage === 1" class="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40" @click="goToPage(currentPage - 1)">
                  Trước
                </button>
                <template v-for="(item, index) in pageItems" :key="index">
                  <span v-if="item === '…'" class="px-1 text-sm text-stone-400">…</span>
                  <button v-else type="button" :aria-label="`Trang ${item}`" :aria-current="item === currentPage ? 'page' : undefined" :class="pageButtonClass(item === currentPage)" @click="goToPage(item as number)">
                    {{ item }}
                  </button>
                </template>
                <button type="button" :disabled="currentPage === pageCount" class="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40" @click="goToPage(currentPage + 1)">
                  Sau
                </button>
              </nav>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
