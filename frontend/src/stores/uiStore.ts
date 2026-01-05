import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  settingsModalOpen: boolean
  toggleSidebar: () => void
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileSidebarOpen: false,
      settingsModalOpen: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

      closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

      openSettingsModal: () => set({ settingsModalOpen: true }),

      closeSettingsModal: () => set({ settingsModalOpen: false }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
)
