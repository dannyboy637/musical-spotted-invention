import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Sparkles, Trash2 } from 'lucide-react'
import {
  useAddItemExclusion,
  useDeleteItemExclusion,
  useItemExclusions,
  useItemExclusionSuggestions,
} from '../../hooks/useDataManagement'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrencyFull, formatNumber } from '../../lib/chartConfig'

export function ItemExclusionsSection() {
  const [itemName, setItemName] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [maxQuantity, setMaxQuantity] = useState('2')
  const [maxRevenue, setMaxRevenue] = useState('10')

  const { data: exclusions, isLoading: exclusionsLoading, error: exclusionsError } = useItemExclusions()

  const maxQuantityParam = maxQuantity.trim()
    ? Math.max(0, Math.floor(Number(maxQuantity)))
    : undefined
  const maxRevenueParam = maxRevenue.trim()
    ? Math.max(0, Math.round(Number(maxRevenue) * 100))
    : undefined

  const { data: suggestions, isLoading: suggestionsLoading } = useItemExclusionSuggestions({
    limit: 12,
    maxQuantity: Number.isFinite(maxQuantityParam) ? maxQuantityParam : undefined,
    maxRevenue: Number.isFinite(maxRevenueParam) ? maxRevenueParam : undefined,
  })
  const addMutation = useAddItemExclusion()
  const deleteMutation = useDeleteItemExclusion()

  const excludedNames = useMemo(() => {
    return new Set((exclusions || []).map((exclusion) => exclusion.item_name.toLowerCase()))
  }, [exclusions])

  const handleAdd = async (name: string, reasonOverride?: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Enter an item name to exclude')
      return
    }
    if (excludedNames.has(trimmed.toLowerCase())) {
      setFormError('Item is already excluded')
      return
    }

    setFormError(null)
    try {
      await addMutation.mutateAsync({
        item_name: trimmed,
        reason: reasonOverride ?? (reason?.trim() || undefined),
      })
      setItemName('')
      setReason('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to exclude item')
    }
  }

  const thresholds = suggestions?.thresholds || {}
  const thresholdLabel = [
    thresholds.max_quantity ? `≤ ${thresholds.max_quantity} qty` : null,
    typeof thresholds.max_revenue === 'number'
      ? `≤ ${formatCurrencyFull(thresholds.max_revenue)}`
      : null,
  ].filter(Boolean).join(' or ')

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Item Exclusions</h2>
          <p className="text-sm text-slate-500 mt-1">
            Exclude modifiers and low-value items so analytics focus on meaningful menu performance.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-700">Add exclusion</h3>
            <div className="mt-3 space-y-3">
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Item name (e.g., Bottled Water)"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional reason"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <button
                onClick={() => handleAdd(itemName)}
                disabled={addMutation.isPending}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  addMutation.isPending
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-navy-600 text-white hover:bg-navy-700'
                }`}
              >
                <Plus size={16} />
                {addMutation.isPending ? 'Adding...' : 'Exclude Item'}
              </button>
              {formError && (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <AlertTriangle size={16} className="mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Current exclusions</h3>
            </div>
            {exclusionsLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                <Spinner size="sm" /> Loading exclusions...
              </div>
            ) : exclusionsError ? (
              <div className="px-4 py-4 text-sm text-red-600">
                Failed to load exclusions
              </div>
            ) : (exclusions && exclusions.length > 0) ? (
              <ul className="divide-y divide-slate-100">
                {exclusions.map((exclusion) => (
                  <li key={exclusion.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{exclusion.item_name}</p>
                      {exclusion.reason && (
                        <p className="text-xs text-slate-500 mt-1">{exclusion.reason}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Added {new Date(exclusion.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(exclusion.id)}
                      disabled={deleteMutation.isPending}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${exclusion.item_name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-4 text-sm text-slate-500">No exclusions yet.</div>
            )}
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles size={16} />
            <h3 className="text-sm font-semibold">Suggested exclusions</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Low-activity items ({thresholdLabel || 'low activity'}) that may skew analytics.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Max quantity
              <input
                value={maxQuantity}
                onChange={(event) => setMaxQuantity(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </label>
            <label className="text-xs text-slate-500">
              Max revenue (₱)
              <input
                value={maxRevenue}
                onChange={(event) => setMaxRevenue(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </label>
          </div>

          {suggestionsLoading ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-500">
              <Spinner size="sm" /> Loading suggestions...
            </div>
          ) : suggestions?.suggestions?.length ? (
            <ul className="mt-4 space-y-3">
              {suggestions.suggestions.map((suggestion) => {
                const alreadyExcluded = excludedNames.has(suggestion.item_name.toLowerCase())
                return (
                  <li
                    key={suggestion.item_name}
                    className="flex items-start justify-between gap-3 border border-slate-100 rounded-md p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {suggestion.item_name}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatNumber(suggestion.total_quantity)} qty · {formatCurrencyFull(suggestion.total_revenue)} revenue
                      </p>
                    </div>
                    <button
                      onClick={() => handleAdd(
                        suggestion.item_name,
                        'Auto-suggested: low activity'
                      )}
                      disabled={alreadyExcluded || addMutation.isPending}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        alreadyExcluded
                          ? 'border-slate-200 text-slate-400'
                          : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                      }`}
                    >
                      {alreadyExcluded ? 'Excluded' : 'Exclude'}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-4 text-sm text-slate-500">No suggestions right now.</div>
          )}
        </div>
      </div>
    </div>
  )
}
