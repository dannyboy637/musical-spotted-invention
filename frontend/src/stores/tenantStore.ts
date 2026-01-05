import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tenant } from './authStore'

interface TenantState {
  // List of all tenants (operators only)
  tenants: Tenant[]
  // Currently selected tenant for viewing (operators can switch)
  activeTenant: Tenant | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchTenants: (accessToken: string) => Promise<void>
  setActiveTenant: (tenant: Tenant | null) => void
  clearTenants: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      tenants: [],
      activeTenant: null,
      isLoading: false,
      error: null,

      fetchTenants: async (accessToken: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/tenants`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (!response.ok) {
            throw new Error('Failed to fetch tenants')
          }

          const tenants = await response.json()
          set({ tenants, isLoading: false })

          // If no active tenant is set, set the first one
          const currentState = useTenantStore.getState()
          if (!currentState.activeTenant && tenants.length > 0) {
            set({ activeTenant: tenants[0] })
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
          })
        }
      },

      setActiveTenant: (tenant: Tenant | null) => {
        set({ activeTenant: tenant })
      },

      clearTenants: () => {
        set({ tenants: [], activeTenant: null, error: null })
      },
    }),
    {
      name: 'tenant-storage',
      partialize: (state) => ({
        // Only persist the active tenant selection
        activeTenant: state.activeTenant,
      }),
    }
  )
)
