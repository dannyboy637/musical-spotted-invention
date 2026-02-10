import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GlobalFilters } from './GlobalFilters'
import { DayDeepDiveModal } from '../analytics/DayDeepDiveModal'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { useFilterStore } from '../../stores/filterStore'
import { useSettingsStore, getDateRangeFromPreference } from '../../stores/settingsStore'

// Routes that have their own filter UI and don't need global filters
const ROUTES_WITHOUT_GLOBAL_FILTERS = ['/recommendations']

export function AppShell() {
  const location = useLocation()
  const { mobileSidebarOpen, closeMobileSidebar } = useUIStore()
  const { session, profile } = useAuthStore()
  const { activeTenant, fetchTenants, setActiveTenant } = useTenantStore()
  const { dateRange, fetchFilterOptions, setDateRange } = useFilterStore()
  const { defaultDateRange } = useSettingsStore()

  // Check if current route should hide global filters
  const hideGlobalFilters = ROUTES_WITHOUT_GLOBAL_FILTERS.includes(location.pathname)

  // Fetch tenants for operators, or set tenant from profile for owner/viewer
  useEffect(() => {
    if (!session?.access_token || !profile) return

    if (profile.role === 'operator') {
      // Operators can switch between tenants
      fetchTenants(session.access_token)
    } else if (profile.tenant && !activeTenant) {
      // Owner/viewer: use their assigned tenant
      setActiveTenant(profile.tenant)
    }
  }, [session?.access_token, profile, activeTenant, fetchTenants, setActiveTenant])

  // Fetch filter options when tenant changes
  useEffect(() => {
    if (session?.access_token && activeTenant) {
      fetchFilterOptions(session.access_token, activeTenant.id)
    }
  }, [session?.access_token, activeTenant, fetchFilterOptions])

  // Apply default date range on first load (when no range is set)
  // Re-run when defaultDateRange changes to pick up the setting after zustand hydrates from localStorage
  useEffect(() => {
    if (dateRange === null && activeTenant) {
      const range = getDateRangeFromPreference(defaultDateRange)
      if (range) {
        setDateRange(range)
      }
    }
  }, [activeTenant, defaultDateRange, dateRange, setDateRange])

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileSidebar}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden">
            <Sidebar mobile />
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* Global Filters (hidden on certain routes) */}
        {!hideGlobalFilters && <GlobalFilters />}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Day Deep Dive Modal */}
      <DayDeepDiveModal />
    </div>
  )
}
