import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { handleApiError } from './toast'

// Check if error is a 401 Unauthorized
const isUnauthorizedError = (error: unknown): boolean => {
  if (error instanceof Error && 'status' in error) {
    return (error as Error & { status: number }).status === 401
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    return err.status === 401 || err.statusCode === 401
  }
  return false
}

// Handle 401 errors by redirecting to login
const handleUnauthorized = () => {
  // Clear any persisted auth state
  localStorage.removeItem('auth-storage')
  // Redirect to login
  window.location.href = '/login'
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Check for 401 and redirect to login
      if (isUnauthorizedError(error)) {
        handleUnauthorized()
        return
      }

      // Only show error toast if the query has already been retried
      // This prevents showing errors for transient failures
      if (query.state.dataUpdateCount > 0) {
        handleApiError(error, 'Failed to load data')
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Check for 401 and redirect to login
      if (isUnauthorizedError(error)) {
        handleUnauthorized()
        return
      }

      // Only show error if mutation doesn't have its own onError handler
      if (!mutation.options.onError) {
        handleApiError(error, 'Operation failed')
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 401, 403, 404
        if (isUnauthorizedError(error)) return false
        if (error instanceof Error && 'status' in error) {
          const status = (error as Error & { status: number }).status
          if (status === 403 || status === 404) return false
        }
        // Retry up to 2 times with exponential backoff
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
})
