import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Only log in development mode
const isDev = import.meta.env.DEV
const log = (...args: unknown[]) => isDev && console.log(...args)
const warn = (...args: unknown[]) => isDev && console.warn(...args)
const logError = (...args: unknown[]) => isDev && console.error(...args)

let authSubscription: { unsubscribe: () => void } | null = null

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
        if (get().isInitialized && authSubscription) {
          return
        }
        try {
          set({ isLoading: true })
          log('[AuthStore] Initializing...')

          // Get current session from Supabase
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            logError('[AuthStore] getSession error:', error)
          }

          log('[AuthStore] Session:', session ? 'found' : 'none')

          if (session) {
            set({ user: session.user, session })
            await get().fetchProfile()
          }

          // Listen for auth changes
          if (authSubscription) {
            authSubscription.unsubscribe()
            authSubscription = null
          }

          const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
            log('[AuthStore] Auth state changed:', event)
            set({ user: session?.user ?? null, session })

            if (session) {
              await get().fetchProfile()
            } else {
              set({ profile: null })
            }
          })
          authSubscription = data.subscription
        } finally {
          set({ isLoading: false, isInitialized: true })
          log('[AuthStore] Initialized')
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        log('[AuthStore] Logging in:', email)

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) {
            logError('[AuthStore] Login error:', error.message)
            return { error: error.message }
          }

          log('[AuthStore] Login successful, fetching profile...')
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
          warn('[AuthStore] No session, skipping profile fetch')
          return
        }

        // Create abort controller with timeout to prevent hanging UI
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
          warn('[AuthStore] Profile fetch timed out after 10 seconds')
        }, 10000) // 10 second timeout

        try {
          log('[AuthStore] Fetching profile from:', `${API_URL}/auth/me`)

          const response = await fetch(
            `${API_URL}/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              signal: controller.signal,
            }
          )

          clearTimeout(timeoutId)

          if (!response.ok) {
            const errorText = await response.text()
            logError('[AuthStore] Profile fetch failed:', response.status, errorText)
            return
          }

          const profile = await response.json()
          log('[AuthStore] Profile loaded:', profile)
          set({ profile })
        } catch (error) {
          clearTimeout(timeoutId)
          if (error instanceof Error && error.name === 'AbortError') {
            warn('[AuthStore] Profile fetch was aborted (timeout or navigation)')
          } else {
            logError('[AuthStore] Failed to fetch profile:', error)
          }
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
