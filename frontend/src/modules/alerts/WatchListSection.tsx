import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useAddWatchItem,
  useAlertSettings,
  useDeleteWatchItem,
  useUpdateWatchItem,
  useWatchList,
} from '../../hooks/useAlerts'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../stores/authStore'

interface DraftState {
  drop: string
  spike: string
  notes: string
}

export function WatchListSection() {
  const { profile } = useAuthStore()
  const canManage = profile?.role === 'owner' || profile?.role === 'operator'

  const { data: watchlist, isLoading } = useWatchList()
  const { data: alertSettings } = useAlertSettings()
  const addMutation = useAddWatchItem()
  const updateMutation = useUpdateWatchItem()
  const deleteMutation = useDeleteWatchItem()

  const [itemName, setItemName] = useState('')
  const [dropPct, setDropPct] = useState('20')
  const [spikePct, setSpikePct] = useState('50')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({})

  useEffect(() => {
    if (!alertSettings) return
    setDropPct(String(alertSettings.revenue_drop_pct ?? 20))
    setSpikePct(String(alertSettings.item_spike_pct ?? 50))
  }, [alertSettings])

  useEffect(() => {
    if (!watchlist) return
    const nextDrafts: Record<string, DraftState> = {}
    watchlist.forEach((item) => {
      nextDrafts[item.id] = {
        drop: String(item.revenue_drop_pct ?? 20),
        spike: String(item.revenue_spike_pct ?? 50),
        notes: item.notes ?? '',
      }
    })
    setDrafts(nextDrafts)
  }, [watchlist])

  const watchedNames = useMemo(() => {
    return new Set((watchlist || []).map((item) => item.item_name.toLowerCase()))
  }, [watchlist])

  const parseThreshold = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return Math.round(parsed)
  }

  const handleAdd = async () => {
    const trimmed = itemName.trim()
    if (!trimmed) {
      setFormError('Enter an item name')
      return
    }
    if (watchedNames.has(trimmed.toLowerCase())) {
      setFormError('Item already in watch list')
      return
    }

    const dropValue = parseThreshold(dropPct)
    const spikeValue = parseThreshold(spikePct)

    if (dropValue == null || spikeValue == null) {
      setFormError('Thresholds must be valid numbers')
      return
    }

    setFormError(null)
    try {
      await addMutation.mutateAsync({
        item_name: trimmed,
        revenue_drop_pct: dropValue,
        revenue_spike_pct: spikeValue,
        notes: notes.trim() || undefined,
      })
      setItemName('')
      setNotes('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  const handleSave = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return

    const dropValue = parseThreshold(draft.drop)
    const spikeValue = parseThreshold(draft.spike)

    if (dropValue == null || spikeValue == null) {
      setFormError('Thresholds must be valid numbers')
      return
    }

    setFormError(null)
    await updateMutation.mutateAsync({
      id,
      revenue_drop_pct: dropValue,
      revenue_spike_pct: spikeValue,
      notes: draft.notes.trim() || undefined,
    })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Watch List</h2>
          <p className="text-sm text-slate-500 mt-1">
            Track specific items and flag large revenue changes automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700">Add item</h3>
          <div className="mt-3 space-y-3">
            <input
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Item name"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              disabled={!canManage}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Drop alert %
                <input
                  value={dropPct}
                  onChange={(event) => setDropPct(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  disabled={!canManage}
                />
              </label>
              <label className="text-xs text-slate-500">
                Spike alert %
                <input
                  value={spikePct}
                  onChange={(event) => setSpikePct(event.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                  disabled={!canManage}
                />
              </label>
            </div>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              disabled={!canManage}
            />
            <button
              onClick={handleAdd}
              disabled={!canManage || addMutation.isPending}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !canManage || addMutation.isPending
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-navy-600 text-white hover:bg-navy-700'
              }`}
            >
              <Plus size={16} />
              {addMutation.isPending ? 'Adding...' : 'Add to Watch List'}
            </button>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            {!canManage && (
              <p className="text-xs text-slate-400">
                Watch list management is available to owners and operators.
              </p>
            )}
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Watched items</h3>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
              <Spinner size="sm" /> Loading watch list...
            </div>
          ) : watchlist && watchlist.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {watchlist.map((item) => {
                const draft = drafts[item.id]
                return (
                  <li key={item.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.item_name}</p>
                        {item.notes && !draft?.notes && (
                          <p className="text-xs text-slate-500 mt-1">{item.notes}</p>
                        )}
                      </div>
                      {canManage && (
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          aria-label={`Remove ${item.item_name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {draft && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-500">
                          Drop alert %
                          <input
                            value={draft.drop}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], drop: event.target.value },
                              }))
                            }
                            inputMode="numeric"
                            className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                            disabled={!canManage}
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          Spike alert %
                          <input
                            value={draft.spike}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], spike: event.target.value },
                              }))
                            }
                            inputMode="numeric"
                            className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                            disabled={!canManage}
                          />
                        </label>
                        <label className="text-xs text-slate-500 col-span-2">
                          Notes
                          <input
                            value={draft.notes}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], notes: event.target.value },
                              }))
                            }
                            className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                            disabled={!canManage}
                          />
                        </label>
                      </div>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleSave(item.id)}
                        disabled={updateMutation.isPending}
                        className={`mt-2 w-full px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          updateMutation.isPending
                            ? 'border-slate-200 text-slate-400'
                            : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save thresholds'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-slate-500">No items in the watch list.</div>
          )}
        </div>
      </div>
    </div>
  )
}
