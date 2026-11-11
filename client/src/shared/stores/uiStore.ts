import { defineStore } from 'pinia'

export type DrawerKind = 'cart' | 'notifications' | null

/** Chi mot drawer mo tai mot thoi diem de hai lop mask khong chong len nhau. */
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
