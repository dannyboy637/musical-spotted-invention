import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DefaultDateRange = 'today' | '7days' | '30days' | '90days' | 'all'
export type NumberFormat = 'us' | 'eu' | 'fr'
export type TimeFormat = '12hr' | '24hr'

export interface KPIOption {
  id: string
  label: string
}

export const AVAILABLE_KPIS: KPIOption[] = [
  { id: 'revenue', label: 'Total Revenue' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'avgTicket', label: 'Avg Ticket' },
  { id: 'growth', label: 'Growth %' },
  { id: 'uniqueItems', label: 'Unique Items' },
  { id: 'bestDay', label: 'Best Day' },
]

export const DATE_RANGE_OPTIONS: { value: DefaultDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
  { value: '90days', label: '90 days' },
  { value: 'all', label: 'All time' },
]

export const NUMBER_FORMAT_OPTIONS: { value: NumberFormat; label: string; example: string }[] = [
  { value: 'us', label: 'US', example: '1,234.56' },
  { value: 'eu', label: 'EU', example: '1.234,56' },
  { value: 'fr', label: 'FR', example: '1 234,56' },
]

export const TABLE_ROWS_OPTIONS = [10, 25, 50, 100]

export const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
  { value: '24hr', label: '24-hour', example: '18:00' },
  { value: '12hr', label: '12-hour', example: '6:00 PM' },
]

interface SettingsState {
  // Settings values
  defaultDateRange: DefaultDateRange
  enabledKPIs: string[]
  numberFormat: NumberFormat
  tableRowsPerPage: number
  timeFormat: TimeFormat

  // Actions
  setDefaultDateRange: (range: DefaultDateRange) => void
  setEnabledKPIs: (kpis: string[]) => void
  toggleKPI: (kpiId: string) => void
  setNumberFormat: (format: NumberFormat) => void
  setTableRowsPerPage: (rows: number) => void
  setTimeFormat: (format: TimeFormat) => void
  resetToDefaults: () => void
}

export const DEFAULT_SETTINGS = {
  defaultDateRange: '90days' as DefaultDateRange,
  enabledKPIs: ['revenue', 'transactions', 'avgTicket', 'uniqueItems'],
  numberFormat: 'us' as NumberFormat,
  tableRowsPerPage: 25,
  timeFormat: '24hr' as TimeFormat,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setDefaultDateRange: (range) => set({ defaultDateRange: range }),

      setEnabledKPIs: (kpis) => set({ enabledKPIs: kpis }),

      toggleKPI: (kpiId) => {
        const current = get().enabledKPIs
        if (current.includes(kpiId)) {
          // Don't allow fewer than 1 KPI
          if (current.length > 1) {
            set({ enabledKPIs: current.filter((id) => id !== kpiId) })
          }
        } else {
          // Don't allow more than 4 KPIs
          if (current.length < 4) {
            set({ enabledKPIs: [...current, kpiId] })
          }
        }
      },

      setNumberFormat: (format) => set({ numberFormat: format }),

      setTableRowsPerPage: (rows) => set({ tableRowsPerPage: rows }),

      setTimeFormat: (format) => set({ timeFormat: format }),

      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'user-settings',
    }
  )
)

// Helper to get date range from preference
export function getDateRangeFromPreference(preference: DefaultDateRange): { start: Date; end: Date } | null {
  if (preference === 'all') {
    return null
  }

  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  switch (preference) {
    case 'today':
      // start is already today
      break
    case '7days':
      start.setDate(start.getDate() - 6)
      break
    case '30days':
      start.setDate(start.getDate() - 29)
      break
    case '90days':
      start.setDate(start.getDate() - 89)
      break
  }

  return { start, end }
}
