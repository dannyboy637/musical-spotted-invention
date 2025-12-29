import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../ui/Spinner'

interface PublicRouteProps {
  children: React.ReactNode
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { user, isLoading, isInitialized } = useAuthStore()

  // Show loading while checking auth state
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // Redirect to dashboard if already authenticated
  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
