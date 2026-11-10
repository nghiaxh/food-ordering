import { defineStore } from 'pinia'

export type DrawerKind = 'cart' | 'notifications' | null

/** Chỉ một drawer mở tại một thời điểm để hai lớp mask không chồng lên nhau. */
export const useUiStore = defineStore('ui', {
  state: () => ({
    activeDrawer: null as DrawerKind,
    chatOpen: false,
  }),
  actions: {
    openDrawer(drawer: Exclude<DrawerKind, null>) {
      this.activeDrawer = drawer
    },
    closeDrawer() {
      this.activeDrawer = null
    },
    openChat() {
      this.chatOpen = true
    },
    closeChat() {
      this.chatOpen = false
    },
  },
})
