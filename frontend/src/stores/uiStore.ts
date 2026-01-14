import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  settingsModalOpen: boolean
  dayDeepDiveOpen: boolean
  dayDeepDiveDate: string | null
  toggleSidebar: () => void
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  openDayDeepDive: (date: string) => void
  closeDayDeepDive: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileSidebarOpen: false,
      settingsModalOpen: false,
      dayDeepDiveOpen: false,
      dayDeepDiveDate: null,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

      closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

      openSettingsModal: () => set({ settingsModalOpen: true }),

      closeSettingsModal: () => set({ settingsModalOpen: false }),

      openDayDeepDive: (date: string) => set({ dayDeepDiveOpen: true, dayDeepDiveDate: date }),

      closeDayDeepDive: () => set({ dayDeepDiveOpen: false, dayDeepDiveDate: null }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
)
