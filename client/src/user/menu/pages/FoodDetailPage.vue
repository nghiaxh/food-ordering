<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NIcon } from 'naive-ui'
import { AlertCircleOutline, ArrowBackOutline } from '@vicons/ionicons5'
import { getFood } from '@/user/menu/api'
import { createReview, deleteReview, getReviews, updateReview } from '@/user/review/api'
import useAsyncData from '@/composables/useAsyncData'
import useAsyncAction from '@/composables/useAsyncAction'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { formatVND } from '@/shared/utils/format'
import { spicyLabel } from '@/shared/utils/food-tags'
import { reviewStats } from '@/shared/utils/reviews'
import { apiErrorMessage } from '@/shared/utils/api-error'
import { message } from '@/shared/api/message'
import RatingStars from '@/user/review/components/RatingStars.vue'
import ReviewSection from '@/user/review/components/ReviewSection.vue'
import QuantityStepper from '@/components/QuantityStepper.vue'

const route = useRoute()
const router = useRouter()
// Nut quay lai uu tien `state.from` do the mon truyen (kem query bo loc); nguoc lai ve "/".
const from = computed(() => (history.state as { from?: string } | null)?.from)
const foodId = computed(() => Number(route.params.id))
const qty = ref(1)
const adding = ref(false)
const auth = useAuthStore()
const cart = useCartStore()
const ui = useUiStore()

const {
  data: food,
  loading: foodLoading,
  error: foodError,
  refresh: reloadFood,
} = useAsyncData((signal) => getFood(foodId.value, signal), () => [foodId.value])

const {
  data: reviews,
  loading: reviewsLoading,
  error: reviewsError,
  refresh: refreshReviews,
} = useAsyncData((signal) => getReviews(foodId.value, signal), () => [foodId.value])

const { run: submitReview, pending: reviewPending } = useAsyncAction(
  (payload: { foodId: number; rating: number; comment?: string }) => createReview(payload),
)
const { run: editReview, pending: editPending } = useAsyncAction(
  (payload: { id: number; rating: number; comment?: string }) =>
    updateReview(payload.id, { rating: payload.rating, comment: payload.comment }),
)
const { run: removeReview } = useAsyncAction((id: number) => deleteReview(id))

const goBack = () => router.push(from.value ?? '/')

const addToCart = async () => {
  const current = food.value
  if (!current?.available || adding.value) return
  if (!auth.user) {
    message.info('Đăng nhập để thêm món vào giỏ')
    router.push({ path: '/login', state: { from: { pathname: route.path, search: route.fullPath.slice(route.path.length) } } })
    return
  }
  const quantity = qty.value
  adding.value = true
  try {
    const ok = await cart.add(current, quantity)
    if (ok) {
      message.success(`Đã thêm ${quantity} phần ${current.name} vào giỏ`)
      ui.openDrawer('cart')
    }
  } finally {
    adding.value = false
  }
}

const onReview = async (payload: { foodId: number; rating: number; comment?: string }) => {
  if (!auth.user) {
    message.warning('Vui lòng đăng nhập để đánh giá')
    return { ok: false as const, error: new Error('Chưa đăng nhập') }
  }
  const res = await submitReview(payload)
  if (res.ok) {
    message.success('Cảm ơn bạn đã đánh giá!')
    void refreshReviews()
  } else {
    message.error(apiErrorMessage(res.error) ?? 'Gửi đánh giá thất bại. Vui lòng thử lại.')
  }
  return res
}

const onEditReview = async (id: number, payload: { rating: number; comment?: string }) => {
  const res = await editReview({ id, ...payload })
  if (res.ok) {
    message.success('Đã cập nhật đánh giá!')
    void refreshReviews()
  } else {
    message.error(apiErrorMessage(res.error) ?? 'Cập nhật đánh giá thất bại.')
  }
  return res
}

const onDeleteReview = async (id: number) => {
  const res = await removeReview(id)
  if (res.ok) {
    message.success('Đã xóa đánh giá')
    void refreshReviews()
  } else {
    message.error(apiErrorMessage(res.error) ?? 'Xóa đánh giá thất bại.')
  }
  return res
}

const unit = computed(() => (food.value ? (food.value.discountedPrice ?? food.value.price) : 0))
const scrollToReviews = () => document.getElementById('danh-gia')?.scrollIntoView({ behavior: 'smooth' })
const saving = computed(() => (food.value ? Math.max(0, food.value.price - unit.value) : 0))
const stats = computed(() => reviewStats(reviews.value ?? []))
const unavailable = computed(() => !!food.value && !food.value.available)
const allergens = computed(() =>
  food.value?.allergens ? food.value.allergens.split(',').map((t) => t.trim()).filter(Boolean) : [],
)
const specs = computed(() => [
  { label: 'Phân loại', value: food.value?.category?.name ?? 'Khác' },
  { label: 'Khẩu phần', value: `${food.value?.servingSize} người` },
  { label: 'Độ cay', value: spicyLabel(food.value?.spicyLevel ?? 0) },
  { label: 'Chế độ ăn', value: food.value?.dietaryTags || 'Thông thường' },
])

// Doi mon (dieu huong tu trang chi tiet nay sang mon khac) thi reset so luong ve 1.
watch(foodId, () => { qty.value = 1 })
</script>

<template>
  <!-- Skeleton khi dang tai. -->
  <div v-if="foodLoading" class="mx-auto max-w-6xl px-4 py-6">
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200/70" />
      <div class="space-y-3">
        <div class="h-8 w-2/3 animate-pulse rounded-xl bg-stone-200/70" />
        <div class="h-5 w-1/3 animate-pulse rounded-xl bg-stone-200/70" />
        <div class="h-24 w-full animate-pulse rounded-xl bg-stone-200/70" />
      </div>
    </div>
  </div>

  <div v-else-if="foodError || !food" class="mx-auto max-w-xl px-4 py-16 text-center">
    <span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-300">
      <NIcon :size="28"><AlertCircleOutline /></NIcon>
    </span>
    <p class="mt-4 text-lg font-semibold text-stone-900">Không tìm thấy món này</p>
    <p class="mt-1 text-sm text-stone-500">Món có thể đã bị xóa hoặc đường dẫn không đúng.</p>
    <div class="mt-5 flex flex-wrap justify-center gap-2">
      <NButton @click="reloadFood">Thử lại</NButton>
      <NButton type="primary" @click="goBack">Về thực đơn</NButton>
    </div>
  </div>

  <div v-else class="mx-auto max-w-6xl px-3 py-4 pb-10 sm:px-6">
    <button
      type="button"
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-orange-50 hover:text-orange-800"
      @click="goBack"
    >
      <NIcon :size="14"><ArrowBackOutline /></NIcon>
      Quay lại thực đơn
    </button>

    <div class="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-8">
      <div class="relative overflow-hidden rounded-2xl bg-stone-100 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        <img :src="food.imageUrl ?? ''" :alt="food.name" class="aspect-[16/10] w-full cursor-zoom-in object-cover" />
        <span v-if="!!food.discountPercent && food.available" class="absolute left-3 top-3 rounded-md bg-orange-700 px-2 py-0.5 text-xs font-semibold text-white">
          -{{ food.discountPercent }}%
        </span>
      </div>

      <div>
        <h1 class="text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-3xl">{{ food.name }}</h1>

        <button v-if="stats.count > 0" type="button" class="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-stone-600 hover:text-orange-800" @click="scrollToReviews">
          <RatingStars :value="Math.round(stats.avg ?? 0)" :size="14" />
          <span class="font-semibold tabular-nums text-stone-900">{{ stats.avg?.toFixed(1) }}</span>
          <span>· {{ stats.count }} đánh giá</span>
        </button>

        <div class="mt-2 flex flex-wrap items-baseline gap-2">
          <span class="text-2xl font-bold leading-none tabular-nums text-orange-800">{{ formatVND(unit) }}</span>
          <template v-if="saving > 0">
            <span class="text-sm tabular-nums text-stone-500 line-through">{{ formatVND(food.price) }}</span>
            <span v-if="!!food.discountPercent" class="rounded-md bg-orange-50 px-1.5 py-0.5 text-xs font-semibold text-orange-800">
              -{{ food.discountPercent }}%
            </span>
          </template>
        </div>

        <p v-if="food.description" class="mt-3 text-sm leading-relaxed text-stone-600">{{ food.description }}</p>

        <div v-if="unavailable" class="mt-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-600">
          Món đang tạm hết. Bạn có thể chọn món khác trong thực đơn.
        </div>
        <div v-else class="mt-4 flex items-center gap-2.5">
          <QuantityStepper v-model:value="qty" :disabled="adding" :label="`Số lượng ${food.name}`" />
          <NButton type="primary" size="large" class="flex-1" :loading="adding" :disabled="adding" @click="addToCart">Thêm vào giỏ</NButton>
        </div>

        <div class="mt-8">
          <h2 class="text-base font-bold text-stone-900">Thông tin món</h2>
          <dl class="mt-3 grid grid-cols-2 gap-2">
            <div v-for="spec in specs" :key="spec.label" class="rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200/60">
              <dt class="text-xs text-stone-500">{{ spec.label }}</dt>
              <dd class="mt-0.5 text-sm font-semibold text-stone-800">{{ spec.value }}</dd>
            </div>
          </dl>

          <dl class="mt-4">
            <dt class="text-xs text-stone-500">Thành phần</dt>
            <dd class="mt-0.5 text-sm leading-relaxed text-stone-800">{{ food.ingredients || 'Chưa cập nhật' }}</dd>
          </dl>

          <div v-if="allergens.length > 0" class="mt-3 flex items-start gap-2.5 rounded-xl bg-red-50/70 px-3.5 py-3 ring-1 ring-red-100">
            <NIcon :size="16" class="mt-0.5 shrink-0 text-red-500"><AlertCircleOutline /></NIcon>
            <p class="text-sm leading-relaxed text-red-800">
              <span class="font-semibold">Lưu ý dị ứng:</span> {{ allergens.join(', ') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div id="danh-gia" class="mt-8 scroll-mt-[calc(var(--header-h)+1rem)]">
      <ReviewSection
        :food-id="foodId"
        :reviews="reviews"
        :loading="reviewsLoading"
        :error="reviewsError"
        :user="auth.user"
        :submitting="reviewPending || editPending"
        :on-refresh="refreshReviews"
        :on-submit="onReview"
        :on-update="onEditReview"
        :on-delete="onDeleteReview"
      />
    </div>
  </div>
</template>
