<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { NButton, NIcon } from 'naive-ui'
import { AlertCircleOutline, ChatboxOutline, Checkmark } from '@vicons/ionicons5'
import type { AuthUser, Review } from '@/shared/types'
import type { AsyncActionResult } from '@/composables/useAsyncAction'
import { formatRelativeTime } from '@/shared/utils/format'
import { RATING_LABELS, reviewStats, reviewerInitials } from '@/shared/utils/reviews'
import RatingStars from '@/modules/review/components/RatingStars.vue'
import SectionHeader from '@/components/SectionHeader.vue'

interface Props {
  foodId: number
  reviews?: Review[]
  loading?: boolean
  error?: unknown
  user: AuthUser | null
  submitting?: boolean
  onRefresh: () => void
  onSubmit: (payload: { foodId: number; rating: number; comment?: string }) => Promise<AsyncActionResult<Review>>
  onUpdate: (id: number, payload: { rating: number; comment?: string }) => Promise<AsyncActionResult<Review>>
  onDelete: (id: number) => Promise<AsyncActionResult<unknown>>
}
const props = withDefaults(defineProps<Props>(), { reviews: () => [], loading: false, submitting: false })

const rating = ref(0)
const comment = ref('')
// Đánh giá đang sửa; cùng một biểu mẫu dùng cho tạo mới và cập nhật.
const editingId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

const stats = computed(() => reviewStats(props.reviews))
// Nội dung nhận xét không bắt buộc, chỉ cần chọn số sao.
const canSubmit = computed(() => rating.value > 0 && !props.submitting)

const resetForm = () => {
  rating.value = 0
  comment.value = ''
  editingId.value = null
}

const startEdit = (review: Review) => {
  editingId.value = review.id
  rating.value = review.rating
  comment.value = review.comment ?? ''
}

const submit = async () => {
  if (!canSubmit.value) return
  const text = comment.value.trim()
  const res =
    editingId.value === null
      ? await props.onSubmit({ foodId: props.foodId, rating: rating.value, comment: text || undefined })
      : await props.onUpdate(editingId.value, { rating: rating.value, comment: text || undefined })
  if (res.ok) resetForm()
}

const remove = async (review: Review) => {
  deletingId.value = review.id
  const res = await props.onDelete(review.id)
  deletingId.value = null
  // Đang sửa chính đánh giá vừa xóa thì đóng luôn biểu mẫu.
  if (res.ok && editingId.value === review.id) resetForm()
}
</script>

<template>
  <section class="mt-10">
    <SectionHeader align="left" title="Đánh giá & nhận xét" />

    <div v-if="props.loading" class="space-y-5">
      <div class="h-16 w-full animate-pulse rounded-xl bg-stone-200/60" />
      <div class="h-14 w-full animate-pulse rounded-xl bg-stone-200/60" />
      <div class="h-14 w-full animate-pulse rounded-xl bg-stone-200/60" />
    </div>

    <div v-else-if="props.error" class="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center">
      <NIcon :size="22" class="text-stone-300"><AlertCircleOutline /></NIcon>
      <p class="mt-3 text-sm text-stone-600">Không tải được đánh giá.</p>
      <NButton class="mt-4" @click="props.onRefresh">Thử lại</NButton>
    </div>

    <template v-else>
      <!-- Bảng 2.22 chỉ yêu cầu điểm trung bình và các đánh giá, không vẽ biểu đồ phân bố sao. -->
      <div v-if="props.reviews.length > 0" class="flex flex-wrap items-end gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-5 py-4">
        <span class="text-4xl font-bold tracking-tight tabular-nums text-stone-900">{{ stats.avg?.toFixed(1) }}</span>
        <span class="pb-1 text-sm text-stone-400">/5</span>
        <RatingStars :value="Math.round(stats.avg ?? 0)" :size="15" class="pb-1" />
        <span class="pb-1 text-sm text-stone-500">{{ stats.count }} đánh giá</span>
      </div>

      <div v-if="props.user" class="mt-4 rounded-2xl border border-stone-200/70 bg-white p-4 sm:p-5">
        <p v-if="editingId !== null" class="mb-3 text-xs font-medium text-amber-700">Đang sửa đánh giá của bạn</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RatingStars :value="rating" :on-change="(value: number) => (rating = value)" :size="20" />
          <span class="text-sm font-medium text-amber-700">{{ rating > 0 ? RATING_LABELS[rating] : 'Chọn số sao' }}</span>
          <span class="ml-auto shrink-0 text-xs tabular-nums text-stone-400">{{ comment.length }}/500</span>
        </div>
        <textarea
          v-model="comment"
          rows="2"
          maxlength="500"
          placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)..."
          class="mt-2.5 w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
        <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-stone-400">
            {{ editingId === null ? 'Chỉ đánh giá được món đã đặt và nhận đơn hoàn thành.' : ' ' }}
          </p>
          <div class="flex items-center gap-2">
            <NButton v-if="editingId !== null" @click="resetForm">Hủy</NButton>
            <NButton type="primary" :disabled="!canSubmit" :loading="props.submitting" @click="submit">
              {{ editingId === null ? 'Gửi đánh giá' : 'Lưu thay đổi' }}
            </NButton>
          </div>
        </div>
      </div>
      <div v-else class="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-4">
        <p class="text-sm text-stone-600">
          Đăng nhập để chia sẻ đánh giá của bạn.
          <RouterLink to="/login" class="font-semibold text-amber-700 hover:underline">Đăng nhập</RouterLink>
        </p>
      </div>

      <div v-if="props.reviews.length > 0" class="mt-4 divide-y divide-stone-100">
        <article v-for="r in props.reviews" :key="r.id" data-testid="review-item" class="flex items-start gap-3 py-4 first:pt-2">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-xs font-bold text-stone-600 ring-1 ring-stone-200/60">
            {{ reviewerInitials(r.userName) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span class="text-sm font-semibold text-stone-900">{{ r.userName }}</span>
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-700">
                <NIcon :size="9"><Checkmark /></NIcon> Đã đặt hàng
              </span>
              <!-- Chỉ đánh giá của chính người đang xem mới có nút thao tác. -->
              <span v-if="r.mine" class="ml-auto flex shrink-0 items-center gap-2 text-xs font-medium">
                <button type="button" class="text-amber-700 hover:underline" @click="startEdit(r)">Sửa</button>
                <button
                  type="button"
                  :disabled="deletingId === r.id"
                  class="text-red-600 hover:underline disabled:opacity-50"
                  @click="remove(r)"
                >
                  {{ deletingId === r.id ? 'Đang xóa' : 'Xóa' }}
                </button>
              </span>
            </div>
            <div class="mt-0.5 flex items-center gap-2">
              <RatingStars :value="r.rating" :size="13" />
              <time class="text-[11px] text-stone-400">{{ formatRelativeTime(r.createdAt) }}</time>
            </div>
            <p v-if="r.comment" data-testid="review-comment" class="mt-1.5 text-sm leading-relaxed text-stone-600">
              {{ r.comment }}
            </p>
          </div>
        </article>
      </div>
      <div v-else class="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
        <span class="grid h-12 w-12 place-items-center rounded-xl bg-white text-xl text-stone-400 ring-1 ring-stone-200/70">
          <NIcon :size="22"><ChatboxOutline /></NIcon>
        </span>
        <h3 class="mt-3 text-base font-semibold text-stone-900">Chưa có đánh giá cho món này</h3>
        <p class="mt-0.5 text-sm text-stone-500">Hãy là người đầu tiên chia sẻ cảm nhận về món ăn này.</p>
        <RouterLink
          v-if="props.user"
          to="/"
          class="mt-4 rounded-full bg-amber-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500 active:scale-[0.97]"
        >
          Khám phá thực đơn
        </RouterLink>
        <RouterLink
          v-else
          to="/login"
          class="mt-4 rounded-full bg-stone-900 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.97]"
        >
          Đăng nhập để đánh giá
        </RouterLink>
      </div>
    </template>
  </section>
</template>
