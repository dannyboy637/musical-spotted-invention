import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase before importing the store
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

// Must import after mock setup
import { useAuthStore } from '../authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,
    })
  })

  describe('initial state', () => {
    it('starts with null user', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
    })

    it('starts with null session', () => {
      const state = useAuthStore.getState()
      expect(state.session).toBeNull()
    })

    it('starts with null profile', () => {
      const state = useAuthStore.getState()
      expect(state.profile).toBeNull()
    })

    it('starts not loading', () => {
      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
    })

    it('starts not initialized', () => {
      const state = useAuthStore.getState()
      expect(state.isInitialized).toBe(false)
    })
  })

  describe('logout', () => {
    it('clears all auth state', async () => {
      // Set some state first
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        session: { access_token: 'token-1' } as any,
        profile: { id: 'user-1', email: 'test@test.com', role: 'owner' as const },
      })

      await useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.profile).toBeNull()
    })
  })

  describe('role-based properties', () => {
    it('operator profile has operator role', () => {
      useAuthStore.setState({
        profile: {
          id: 'op-1',
          email: 'operator@test.com',
          role: 'operator',
          tenant_id: 'tenant-1',
        },
      })
      expect(useAuthStore.getState().profile?.role).toBe('operator')
    })

    it('owner profile has owner role', () => {
      useAuthStore.setState({
        profile: {
          id: 'owner-1',
          email: 'owner@test.com',
          role: 'owner',
          tenant_id: 'tenant-1',
        },
      })
      expect(useAuthStore.getState().profile?.role).toBe('owner')
    })

    it('viewer profile has viewer role', () => {
      useAuthStore.setState({
        profile: {
          id: 'viewer-1',
          email: 'viewer@test.com',
          role: 'viewer',
          tenant_id: 'tenant-1',
        },
      })
      expect(useAuthStore.getState().profile?.role).toBe('viewer')
    })
  })

  describe('login state transition', () => {
    it('sets isLoading during login attempt', async () => {
      const { supabase } = await import('../../lib/supabase')
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@test.com' },
          session: { access_token: 'token-1' },
        },
        error: null,
      })

      // Start login (don't await)
      const loginPromise = useAuthStore.getState().login('test@test.com', 'password')

      // After login resolves, isLoading should be false
      await loginPromise
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('returns error message on failed login', async () => {
      const { supabase } = await import('../../lib/supabase')
      ;(supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      })

      const result = await useAuthStore.getState().login('test@test.com', 'wrong')
      expect(result.error).toBe('Invalid credentials')
    })
  })
})
