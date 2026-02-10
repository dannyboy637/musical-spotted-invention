import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { DataFreshnessSection } from './DataFreshnessSection'
import { CSVUploadForm } from './CSVUploadForm'
import { ImportHistoryTable } from './ImportHistoryTable'
import { RegenerateSection } from './RegenerateSection'
import { ItemExclusionsSection } from './ItemExclusionsSection'

export function DataManagementPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  // Permission check - owner or operator only
  const canManageData = profile?.role === 'owner' || profile?.role === 'operator'

  if (!canManageData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-navy-900">Data Management</h1>
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            Data management is only available to owners and operators.
          </p>
        </div>
      </div>
    )
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-navy-900">Data Management</h1>
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            {profile?.role === 'operator'
              ? 'Select a tenant from the header to manage their data.'
              : 'No tenant assigned. Contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Data Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import and manage data for {currentTenant.name}
        </p>
      </div>

      {/* Data Freshness Indicators */}
      <DataFreshnessSection />

      {/* Upload and Regenerate row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CSVUploadForm />
        <RegenerateSection />
      </div>

      {/* Import History */}
      <ImportHistoryTable />

      {/* Item Exclusions */}
      <ItemExclusionsSection />
    </div>
  )
}
