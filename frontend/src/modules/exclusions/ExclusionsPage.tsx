import { useState, useMemo } from 'react'
import { Filter, Trash2, Plus, Lightbulb, ShieldOff } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  useExclusions,
  useExclusionSuggestions,
  useAddExclusion,
  useRemoveExclusion,
  REASON_LABELS,
  SUGGESTION_REASON_LABELS,
  type ExclusionSuggestion,
} from '../../hooks/useExclusions'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(cents: number): string {
  return `P${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

export function ExclusionsPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [reasonFilter, setReasonFilter] = useState<string>('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  const { data: exclusionsData, isLoading: loadingExclusions } = useExclusions()
  const { data: suggestionsData, isLoading: loadingSuggestions } = useExclusionSuggestions()
  const addMutation = useAddExclusion()
  const removeMutation = useRemoveExclusion()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant
  const canManage = profile?.role === 'owner' || profile?.role === 'operator'

  // Filter exclusions by reason
  const filteredExclusions = useMemo(() => {
    const exclusions = exclusionsData?.exclusions || []
    if (!reasonFilter) return exclusions
    return exclusions.filter((e) => e.reason === reasonFilter)
  }, [exclusionsData?.exclusions, reasonFilter])

  const handleRemove = async (exclusionId: string) => {
    setRemovingId(exclusionId)
    try {
      await removeMutation.mutateAsync(exclusionId)
    } finally {
      setRemovingId(null)
    }
  }

  const handleAddSuggestion = async (suggestion: ExclusionSuggestion) => {
    const reason = suggestion.suggestion_reason === 'modifier_keyword'
      ? 'modifier'
      : suggestion.suggestion_reason === 'single_sale' || suggestion.suggestion_reason.includes('low')
        ? 'low_volume'
        : 'manual'

    setAddingIds((prev) => new Set(prev).add(suggestion.menu_item_id))
    try {
      await addMutation.mutateAsync({
        menu_item_ids: [suggestion.menu_item_id],
        reason,
      })
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(suggestion.menu_item_id)
        return next
      })
    }
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Item Exclusions" />
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            {profile?.role === 'operator'
              ? 'Select a tenant from the header to manage exclusions.'
              : 'No tenant assigned. Contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  const reasonOptions = [
    { value: '', label: 'All Reasons' },
    { value: 'modifier', label: 'Modifier' },
    { value: 'non_analytical', label: 'Non-Analytical' },
    { value: 'low_volume', label: 'Low Volume' },
    { value: 'manual', label: 'Manual' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Exclusions"
        subtitle={`Manage excluded items for ${currentTenant.name}`}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Excluded Items</p>
          <p className="text-2xl font-semibold text-navy-900 dark:text-white">
            {exclusionsData?.total ?? '-'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Suggestions</p>
          <p className="text-2xl font-semibold text-gold-600 dark:text-gold-400">
            {suggestionsData?.total ?? '-'}
          </p>
        </div>
      </div>

      {/* Current Exclusions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <ShieldOff className="h-5 w-5" />
            Current Exclusions
          </h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingExclusions ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Loading exclusions...</p>
          </div>
        ) : !filteredExclusions.length ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
            <ShieldOff className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 mb-2">No excluded items</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Exclude modifiers, add-ons, and non-analytical items to clean up your analytics.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Item Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Date Excluded</th>
                    {canManage && (
                      <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredExclusions.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                        {item.item_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {REASON_LABELS[item.reason] || item.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatDate(item.created_at)}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemove(item.id)}
                            disabled={removingId === item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title="Remove exclusion"
                          >
                            {removingId === item.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div>
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-gold-500" />
          Suggested Exclusions
        </h2>

        {loadingSuggestions ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Analyzing menu items...</p>
          </div>
        ) : !suggestionsData?.suggestions?.length ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
            <Lightbulb className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No suggestions</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              All items look like they should be included in analytics.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Item Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Qty Sold</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">% of Total</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Reason</th>
                    {canManage && (
                      <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {suggestionsData.suggestions.map((s) => (
                    <tr key={s.menu_item_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                        {s.item_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {s.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {s.total_quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(s.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                        {s.revenue_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400">
                          {SUGGESTION_REASON_LABELS[s.suggestion_reason] || s.suggestion_reason}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleAddSuggestion(s)}
                            disabled={addingIds.has(s.menu_item_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-navy-600 hover:bg-navy-700 rounded transition-colors disabled:opacity-50"
                          >
                            {addingIds.has(s.menu_item_id) ? (
                              <Spinner size="sm" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Exclude
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
