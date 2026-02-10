import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const ANALYTICS_QUERY_PREFIXES = [
  'analytics-overview',
  'analytics-menu-engineering',
  'analytics-dayparting',
  'analytics-hourly-heatmap',
  'analytics-daily-breakdown',
  'analytics-categories',
  'analytics-category-items',
  'analytics-category-by-branch',
  'analytics-bundles',
  'analytics-performance',
  'analytics-performance-trends',
  'analytics-performance-branches',
  'analytics-day-of-week',
  'analytics-year-over-year',
  'day-breakdown',
  'movements-quadrant-timeline',
  'movements-yoy-summary',
  'movements-seasonal',
  'movements-item-history',
]

function invalidateAnalyticsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  ANALYTICS_QUERY_PREFIXES.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] })
  })
}

// Types
export interface ExcludedItem {
  id: string
  tenant_id: string
  menu_item_id: string
  item_name: string
  reason: 'modifier' | 'non_analytical' | 'low_volume' | 'manual'
  excluded_by: string | null
  created_at: string
}

export interface ExclusionsListResponse {
  exclusions: ExcludedItem[]
  total: number
}

export interface ExclusionSuggestion {
  menu_item_id: string
  item_name: string
  category: string | null
  total_quantity: number
  total_revenue: number
  revenue_pct: number
  suggestion_reason: string
}

export interface SuggestionsListResponse {
  suggestions: ExclusionSuggestion[]
  total: number
}

export interface AddExclusionParams {
  menu_item_ids: string[]
  reason: string
}

// Fetch current exclusions
export function useExclusions() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<ExclusionsListResponse>({
    queryKey: ['exclusions', tenantId],
    queryFn: async () => {
      if (!accessToken) throw new Error('No access token')

      const params: Record<string, string> = {}
      if (tenantId) params.tenant_id = tenantId

      const response = await axios.get<ExclusionsListResponse>(
        `${API_URL}/api/exclusions`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params,
        }
      )
      return response.data
    },
    enabled: !!accessToken,
  })
}

// Fetch exclusion suggestions
export function useExclusionSuggestions() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<SuggestionsListResponse>({
    queryKey: ['exclusion-suggestions', tenantId],
    queryFn: async () => {
      if (!accessToken) throw new Error('No access token')

      const params: Record<string, string> = {}
      if (tenantId) params.tenant_id = tenantId

      const response = await axios.get<SuggestionsListResponse>(
        `${API_URL}/api/exclusions/suggestions`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params,
        }
      )
      return response.data
    },
    enabled: !!accessToken,
  })
}

// Add items to exclusion list
export function useAddExclusion() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation<ExclusionsListResponse, Error, AddExclusionParams>({
    mutationFn: async (params) => {
      if (!session?.access_token) throw new Error('No access token')

      const queryParams: Record<string, string> = {}
      if (activeTenant?.id) queryParams.tenant_id = activeTenant.id

      const response = await axios.post<ExclusionsListResponse>(
        `${API_URL}/api/exclusions`,
        params,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params: queryParams,
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] })
      queryClient.invalidateQueries({ queryKey: ['exclusion-suggestions'] })
      invalidateAnalyticsQueries(queryClient)
    },
  })
}

// Remove an exclusion
export function useRemoveExclusion() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<{ message: string; id: string }, Error, string>({
    mutationFn: async (exclusionId) => {
      if (!session?.access_token) throw new Error('No access token')

      const response = await axios.delete(
        `${API_URL}/api/exclusions/${exclusionId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] })
      queryClient.invalidateQueries({ queryKey: ['exclusion-suggestions'] })
      invalidateAnalyticsQueries(queryClient)
    },
  })
}

// Reason labels for display
export const REASON_LABELS: Record<string, string> = {
  modifier: 'Modifier',
  non_analytical: 'Non-Analytical',
  low_volume: 'Low Volume',
  manual: 'Manual',
}

// Suggestion reason labels
export const SUGGESTION_REASON_LABELS: Record<string, string> = {
  modifier_keyword: 'Modifier keyword detected',
  single_sale: 'Only sold once',
  very_low_revenue: 'Very low revenue (<0.1%)',
  low_revenue: 'Low revenue (<1%)',
}
