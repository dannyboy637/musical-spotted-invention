import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'
import { useFilterStore } from '../stores/filterStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface HourlyBreakdownItem {
  hour: number
  revenue: number
  transactions: number
  quantity: number
}

export interface TopItemData {
  item_name: string
  quantity: number
  revenue: number
}

export interface DayComparisonData {
  prior_date: string
  prior_revenue: number
  prior_transactions: number
  revenue_change_pct: number | null
  transactions_change_pct: number | null
  top_items_overlap: number
}

export interface DayBreakdownData {
  date: string
  day_name: string
  total_revenue: number
  total_transactions: number
  total_quantity: number
  avg_ticket: number
  hourly: HourlyBreakdownItem[]
  peak_hour: number
  top_items: TopItemData[]
  bottom_items: TopItemData[]
  comparison: DayComparisonData | null
  filters_applied: Record<string, unknown>
  generated_at: string
}

export function useDayBreakdown(date: string | null) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { branches, categories } = useFilterStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<DayBreakdownData>({
    queryKey: ['day-breakdown', tenantId, date, branches, categories],
    queryFn: async () => {
      if (!accessToken || !date) {
        throw new Error('Missing required parameters')
      }

      const params: Record<string, string> = { date }
      if (tenantId) params.tenant_id = tenantId
      if (branches.length > 0) params.branches = branches.join(',')
      if (categories.length > 0) params.categories = categories.join(',')

      const response = await axios.get<DayBreakdownData>(
        `${API_URL}/api/analytics/day-breakdown`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params,
        }
      )

      return response.data
    },
    enabled: !!accessToken && !!date,
    staleTime: 30000, // 30 seconds
  })
}
