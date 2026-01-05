import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'operator' | 'owner' | 'viewer'

export interface Tenant {
  id: string
  name: string
  slug: string
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: UserRole
  tenant_id?: string | null
  tenant?: Tenant | null
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,

      initialize: async () => {
        try {
          set({ isLoading: true })
          console.log('[AuthStore] Initializing...')

          // Get current session from Supabase
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            console.error('[AuthStore] getSession error:', error)
          }

          console.log('[AuthStore] Session:', session ? 'found' : 'none')

          if (session) {
            set({ user: session.user, session })
            await get().fetchProfile()
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthStore] Auth state changed:', event)
            set({ user: session?.user ?? null, session })

            if (session) {
              await get().fetchProfile()
            } else {
              set({ profile: null })
            }
          })
        } finally {
          set({ isLoading: false, isInitialized: true })
          console.log('[AuthStore] Initialized')
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        console.log('[AuthStore] Logging in:', email)

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) {
            console.error('[AuthStore] Login error:', error.message)
            return { error: error.message }
          }

          console.log('[AuthStore] Login successful, fetching profile...')
          set({ user: data.user, session: data.session })
          await get().fetchProfile()

          return { error: null }
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        set({ isLoading: true })

        try {
          await supabase.auth.signOut()
          set({ user: null, session: null, profile: null })
        } finally {
          set({ isLoading: false })
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true })

        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          })

          if (error) {
            return { error: error.message }
          }

          return { error: null }
        } finally {
          set({ isLoading: false })
        }
      },

      fetchProfile: async () => {
        const { session } = get()
        if (!session) {
          console.warn('[AuthStore] No session, skipping profile fetch')
          return
        }

        try {
          const apiUrl = import.meta.env.VITE_API_URL
          console.log('[AuthStore] Fetching profile from:', `${apiUrl}/auth/me`)

          const response = await fetch(
            `${apiUrl}/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          )

          if (!response.ok) {
            const errorText = await response.text()
            console.error('[AuthStore] Profile fetch failed:', response.status, errorText)
            return
          }

          const profile = await response.json()
          console.log('[AuthStore] Profile loaded:', profile)
          set({ profile })
        } catch (error) {
          console.error('[AuthStore] Failed to fetch profile:', error)
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        session: state.session,
        profile: state.profile,
      }),
    }
  )
)
