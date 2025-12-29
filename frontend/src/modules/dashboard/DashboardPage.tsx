import { useAuthStore } from '../../stores/authStore'

export function DashboardPage() {
  const { user, profile, logout } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">
            Restaurant Analytics
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">
              {user?.email}
              {profile?.role && (
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                  {profile.role}
                </span>
              )}
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!
          </h2>
          <p className="text-gray-600">
            Dashboard content coming in Phase 2.
          </p>
        </div>
      </main>
    </div>
  )
}
