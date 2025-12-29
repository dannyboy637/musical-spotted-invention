import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'manager' | 'viewer'
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

          // Get current session
          const { data: { session } } = await supabase.auth.getSession()

          if (session) {
            set({ user: session.user, session })
            await get().fetchProfile()
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (_event, session) => {
            set({ user: session?.user ?? null, session })

            if (session) {
              await get().fetchProfile()
            } else {
              set({ profile: null })
            }
          })
        } finally {
          set({ isLoading: false, isInitialized: true })
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) {
            return { error: error.message }
          }

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
        if (!session) return

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          )

          if (response.ok) {
            const profile = await response.json()
            set({ profile })
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error)
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
