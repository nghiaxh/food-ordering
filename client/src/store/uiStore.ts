import { create } from 'zustand'

export type DrawerKind = 'cart' | 'notifications' | null

interface UiState {
  /** Chỉ một drawer mở tại một thời điểm để hai lớp mask không chồng lên nhau. */
  activeDrawer: DrawerKind
  chatOpen: boolean
  openDrawer: (drawer: Exclude<DrawerKind, null>) => void
  closeDrawer: () => void
  openChat: () => void
  closeChat: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeDrawer: null,
  chatOpen: false,
  openDrawer: (drawer) => set({ activeDrawer: drawer }),
  closeDrawer: () => set({ activeDrawer: null }),
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
}))
