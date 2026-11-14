<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { NInput, NIcon, NTooltip } from 'naive-ui'
import {
  ChatbubbleOutline,
  CloseOutline,
  SendOutline,
  CartOutline,
  RefreshOutline,
  StopCircleOutline,
  ExpandOutline,
  ContractOutline,
} from '@vicons/ionicons5'
import type { Food, FoodCard, ChatMessage } from '@/shared/types'
import { formatVND } from '@/shared/utils/format'
import { useHasBottomBar } from '@/composables/useHasBottomBar'
import { useChatConversation, GREETING_STARTERS } from '@/user/chatbot/useChatConversation'
import { useAuthStore } from '@/user/auth/store'
import { useCartStore } from '@/user/cart/store'
import { useUiStore } from '@/shared/stores/uiStore'
import { message } from '@/shared/api/message'

/**
 * Widget chatbot noi o moi trang khach voi mot session duy nhat luu qua localStorage.
 */
const route = useRoute()
const bottomBar = useHasBottomBar()
const ui = useUiStore()
const auth = useAuthStore()
const cart = useCartStore()

const {
  input, setInput, loading, statusText, error, messages, draft,
  unavailable, statusNotice, handleSend, handleRetry,
  resetChat, stopStreaming, isStreaming,
} = useChatConversation()

const listRef = ref<HTMLElement | null>(null)
const scrollToBottom = () => {
  void nextTick(() => listRef.value?.scrollTo({ top: listRef.value.scrollHeight }))
}
// Tu cuon xuong cuoi moi khi co tin moi, bot dang tra loi hoac draft doi.
watch(
  [messages, loading, () => draft.value],
  scrollToBottom,
  { deep: true },
)
// Doi kich thuoc khung thi giu nguoi dung o tin moi nhat.
watch(() => ui.chatExpanded, scrollToBottom)

// Esc thu nho truoc, bam lan nua moi dong han; tranh dong mat hoi thoai dang doc.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !ui.chatOpen) return
  if (ui.chatExpanded) ui.setChatExpanded(false)
  else ui.closeChat()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Panel nho giu kich thuoc widget; mo rong thi phu kin vung duoi header, noi dung
// ben trong van gioi han max-w-3xl de dong chu khong keo het chieu ngang.
const panelClass = computed(() =>
  ui.chatExpanded
    ? 'max-h-none w-full max-w-none rounded-none border-0 shadow-none'
    : 'max-h-[600px] w-[420px] max-w-full rounded-2xl border border-orange-200/70 shadow-2xl shadow-orange-900/10 max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0',
)

const isAdmin = computed(() => route.path.startsWith('/admin') || auth.user?.role === 'ADMIN')
const canAdd = computed(() => auth.user !== null && auth.user.role !== 'ADMIN')

const showBody = computed(() => !unavailable.value || messages.value.some((m) => m.sender === 'USER'))
// Diem vao chi hien khi hoi thoai moi tinh (hai bubble loi chao); bien mat sau tin dau tien.
const showStarters = computed(
  () => !unavailable.value && !loading.value && messages.value.length === 2 && messages.value.every((m) => m.sender === 'BOT'),
)
const streamingMessage = computed<ChatMessage | null>(() => {
  const d = draft.value
  if (!d) return null
  const totalWords = d.content.split(/\s+/).length
  const complete = totalWords <= d.shownWords
  return {
    sender: 'BOT',
    content: d.content.split(/\s+/).slice(0, d.shownWords).join(' '),
    foods: complete ? d.foods : [],
    citations: complete ? d.citations : undefined,
    intent: d.intent,
    quickReplies: complete ? d.quickReplies : undefined,
  }
})
const renderedMessages = computed(() =>
  streamingMessage.value ? [...messages.value, streamingMessage.value] : messages.value,
)

const handleAdd = async (f: FoodCard) => {
  if (!canAdd.value) return
  const portions = f.portions && f.portions > 0 ? f.portions : 1
  const ok = await cart.add(f as unknown as Food, portions)
  if (ok) message.success(`Đã thêm ${portions}x ${f.name} vào giỏ!`)
}
</script>

<template>
  <div
    v-if="!isAdmin"
    class="pointer-events-none fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 flex flex-col items-end justify-end gap-3"
    :class="ui.chatExpanded ? 'p-0' : ['px-4 sm:px-5', bottomBar ? 'pb-[6.25rem] lg:pb-3' : 'pb-2 sm:pb-3']"
  >
    <div v-if="ui.chatOpen" data-testid="chatbot-panel" class="chat-open pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden bg-white" :class="panelClass">
      <div class="shrink-0 bg-orange-600 px-2.5 py-1.5">
        <div class="mx-auto flex w-full max-w-3xl items-center gap-2">
          <p class="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-white">Trợ lý gợi ý món ăn</p>
          <NTooltip placement="bottom">
            <template #trigger>
              <button
                type="button"
                :aria-label="ui.chatExpanded ? 'Thu nhỏ khung chat' : 'Mở rộng khung chat'"
                :aria-pressed="ui.chatExpanded"
                class="hidden h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-orange-100 transition hover:bg-white/15 hover:text-white sm:grid"
                @click="ui.toggleChatExpanded()"
              >
                <NIcon :size="18"><ContractOutline v-if="ui.chatExpanded" /><ExpandOutline v-else /></NIcon>
              </button>
            </template>
            {{ ui.chatExpanded ? 'Thu nhỏ khung chat' : 'Mở rộng khung chat' }}
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <button type="button" aria-label="Làm mới hội thoại" class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-orange-100 transition hover:bg-white/15 hover:text-white" @click="resetChat">
                <NIcon :size="18"><RefreshOutline /></NIcon>
              </button>
            </template>
            Làm mới hội thoại
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <button type="button" aria-label="Đóng trợ lý" class="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-orange-100 transition hover:bg-white/15 hover:text-white" @click="ui.closeChat()">
                <NIcon :size="18"><CloseOutline /></NIcon>
              </button>
            </template>
            Đóng trợ lý
          </NTooltip>
        </div>
      </div>

      <div v-if="unavailable" class="shrink-0 border-b border-orange-200 bg-orange-50 px-3 py-2 text-center text-xs text-orange-800">
        {{ statusNotice }}
      </div>

      <div ref="listRef" class="flex-1 overflow-y-auto overscroll-contain bg-stone-50/70 p-3">
        <div class="mx-auto w-full max-w-3xl space-y-3">
          <p v-if="statusText && loading" class="text-xs text-orange-800">{{ statusText }}</p>

          <template v-if="showBody">
            <div v-for="(m, index) in renderedMessages" :key="index" :class="m.sender === 'BOT' ? '' : 'flex justify-end'">
              <div :class="m.sender === 'BOT' ? 'max-w-[92%]' : 'max-w-[85%]'">
                <div v-if="m.sender === 'BOT'" data-testid="chatbot-bot-message" class="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm leading-relaxed text-stone-700 ring-1 ring-stone-200/70">
                  {{ m.content }}
                  <span v-if="isStreaming && index === renderedMessages.length - 1" class="ml-0.5 inline-block h-3.5 w-1 animate-pulse rounded-sm bg-stone-400 align-middle" />
                </div>
                <div v-else class="whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-600 px-3 py-2 text-sm text-white">
                  {{ m.content }}
                </div>

                <p v-if="m.sender === 'BOT' && m.citations && m.citations.length > 0" class="mt-1 text-[11px] text-stone-500">
                  Nguồn: {{ m.citations.map((c) => c.sourceName).join(', ') }}
                </p>

                <div v-if="index === renderedMessages.length - 1 && m.sender === 'BOT' && !isStreaming && !loading && m.quickReplies && m.quickReplies.length > 0" class="mt-2 flex flex-wrap gap-1.5">
                  <button
                    v-for="s in m.quickReplies"
                    :key="s"
                    type="button"
                    :disabled="loading || unavailable"
                    class="cursor-pointer rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800 ring-1 ring-orange-200/70 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="handleSend(s)"
                  >
                    {{ s }}
                  </button>
                </div>

                <div v-if="m.foods && m.foods.length > 0" class="mt-2 divide-y divide-stone-100 overflow-hidden rounded-xl bg-white ring-1 ring-stone-200/70">
                  <RouterLink v-for="f in m.foods" :key="f.id" :to="`/foods/${f.id}`" data-testid="chatbot-food-card" class="flex items-center gap-2.5 px-2.5 py-2 transition hover:bg-orange-50">
                    <img :src="f.imageUrl ?? ''" :alt="f.name" loading="lazy" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                      {{ f.name }}
                      <span v-if="f.portions && f.portions > 1" class="ml-1.5 text-xs font-normal text-stone-500">x{{ f.portions }} phần</span>
                    </span>
                    <span data-testid="chatbot-food-total" class="shrink-0 text-sm font-bold tabular-nums text-orange-700">
                      {{ f.portions && f.portions > 1 && f.totalPrice ? formatVND(Number(f.totalPrice)) : formatVND(Number(f.price)) }}
                    </span>
                    <NTooltip :disabled="canAdd">
                      <template #trigger>
                        <span class="ml-1 inline-flex shrink-0" @click="!canAdd && $event.preventDefault()">
                          <button
                            type="button"
                            :disabled="!canAdd"
                            :aria-label="`Thêm ${f.name} vào giỏ`"
                            class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-700 transition hover:bg-orange-600 hover:text-white disabled:pointer-events-none disabled:bg-stone-100 disabled:text-stone-400"
                            @click.stop="handleAdd(f)"
                          >
                            <NIcon :size="14"><CartOutline /></NIcon>
                          </button>
                        </span>
                      </template>
                      {{ auth.user?.role === 'ADMIN' ? 'Tài khoản quản trị không đặt món' : 'Đăng nhập để thêm món vào giỏ' }}
                    </NTooltip>
                  </RouterLink>
                </div>
              </div>
            </div>

            <div v-if="showStarters" class="flex flex-wrap gap-1.5 pl-0.5">
              <button
                v-for="s in GREETING_STARTERS"
                :key="s"
                type="button"
                class="cursor-pointer rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800 ring-1 ring-orange-200/70 transition hover:bg-orange-100"
                @click="handleSend(s)"
              >
                {{ s }}
              </button>
            </div>
          </template>

          <div v-if="loading && !isStreaming" class="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5 ring-1 ring-stone-200/70">
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400" style="animation-delay: 0ms" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400" style="animation-delay: 150ms" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400" style="animation-delay: 300ms" />
          </div>

          <button
            v-if="error && !loading"
            type="button"
            class="cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-medium text-orange-700 ring-1 ring-stone-200 transition hover:bg-orange-50"
            @click="handleRetry"
          >
            Thử lại
          </button>
          <button
            v-if="isStreaming"
            type="button"
            class="cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-50"
            @click="stopStreaming"
          >
            <NIcon :size="13" class="mr-1 align-middle"><StopCircleOutline /></NIcon>Dừng
          </button>
        </div>
      </div>

      <div class="shrink-0 border-t border-stone-100 bg-white p-2.5">
        <div class="mx-auto w-full max-w-3xl">
          <NInput
            :value="input"
            :disabled="loading || unavailable"
            :placeholder="unavailable ? 'Trợ lý đang tạm tắt' : 'Nhập yêu cầu món ăn...'"
            aria-label="Nhập câu hỏi cho chatbot"
            class="!pr-1.5"
            size="large"
            @update:value="setInput"
            @keyup.enter="handleSend()"
          >
            <template #suffix>
              <button
                type="button"
                aria-label="Gửi câu hỏi"
                :disabled="!input.trim() || loading || unavailable"
                class="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-orange-600 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-stone-200"
                @click="handleSend()"
              >
                <NIcon :size="18"><SendOutline /></NIcon>
              </button>
            </template>
          </NInput>
        </div>
      </div>
    </div>

    <button
      v-if="!ui.chatExpanded"
      type="button"
      data-testid="chatbot-launcher"
      :aria-label="ui.chatOpen ? 'Đóng trợ lý' : 'Mở trợ lý'"
      class="pointer-events-auto grid h-16 w-16 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-orange-600 text-white shadow-2xl shadow-orange-900/30 transition hover:bg-orange-500 max-sm:h-14 max-sm:w-14"
      :class="ui.chatOpen ? 'max-sm:invisible' : ''"
      @click="ui.chatOpen ? ui.closeChat() : ui.openChat()"
    >
      <NIcon :size="28"><CloseOutline v-if="ui.chatOpen" /><ChatbubbleOutline v-else /></NIcon>
    </button>
  </div>
</template>
