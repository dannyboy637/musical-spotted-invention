import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'

export function TenantSwitcher() {
  const { profile, session } = useAuthStore()
  const { tenants, activeTenant, fetchTenants, setActiveTenant, isLoading } = useTenantStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Only show for operators
  const isOperator = profile?.role === 'operator'

  // Fetch tenants on mount for operators
  useEffect(() => {
    if (isOperator && session?.access_token && tenants.length === 0) {
      fetchTenants(session.access_token)
    }
  }, [isOperator, session?.access_token, tenants.length, fetchTenants])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Non-operators see their tenant name (if assigned)
  if (!isOperator) {
    if (!profile?.tenant) return null
    return (
      <span className="text-sm text-gray-600 px-3 py-1 bg-gray-100 rounded">
        {profile.tenant.name}
      </span>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
        disabled={isLoading}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span>{activeTenant?.name || 'Select Tenant'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wide">
              Switch Tenant
            </div>
            {tenants.length === 0 ? (
              <div className="px-2 py-3 text-sm text-gray-500">
                {isLoading ? 'Loading...' : 'No tenants available'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      setActiveTenant(tenant)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-2 py-2 rounded text-sm hover:bg-gray-100 flex items-center justify-between ${
                      activeTenant?.id === tenant.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                    }`}
                  >
                    <span>{tenant.name}</span>
                    {activeTenant?.id === tenant.id && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
