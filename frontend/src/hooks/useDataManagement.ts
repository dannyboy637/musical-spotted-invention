import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types for import jobs
export interface ImportJob {
  id: string
  tenant_id: string
  tenant_name: string | null  // Included via join
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'deleted'
  file_name: string
  file_path: string
  file_size_bytes: number | null
  total_rows: number | null
  processed_rows: number | null
  inserted_rows: number | null
  skipped_rows: number | null  // Includes non-item rows + duplicates
  error_rows: number | null
  error_message: string | null
  error_details: {
    errors?: { row: number; error: string }[]
    duplicate_skipped?: number  // Count of duplicate rows that were skipped
  } | null
  date_range_start: string | null
  date_range_end: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  created_by: string | null
  import_type: string
}

export interface UploadResponse {
  job_id: string
  status: string
  message: string
  file_path: string
}

export interface DataHealthResponse {
  tenant_id: string
  functions?: Record<string, boolean>
  counts: {
    transactions: number | string
    menu_items: number | string
  }
  date_range: {
    start: string | null
    end: string | null
  }
  issues?: string[]
}

export interface ItemExclusion {
  id: string
  item_name: string
  reason: string | null
  created_at: string
  created_by: string | null
}

export interface ItemExclusionSuggestion {
  item_name: string
  total_quantity: number
  total_revenue: number
  order_count: number
  first_sale_date: string | null
  last_sale_date: string | null
}

export interface ItemExclusionSuggestionsResponse {
  suggestions: ItemExclusionSuggestion[]
  thresholds: {
    max_quantity?: number | null
    max_revenue?: number | null
  }
}

// Hook to list import jobs
export function useImportJobs(limit = 20, offset = 0, options?: { pollingWhileProcessing?: boolean }) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  return useQuery<ImportJob[]>({
    queryKey: ['import-jobs', activeTenant?.id, limit, offset],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.get(`${API_URL}/data/imports`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        params: { limit, offset },
      })
      return response.data
    },
    enabled: !!session?.access_token,
    // Poll every 3s when any job is pending/processing
    refetchInterval: options?.pollingWhileProcessing
      ? (query) => {
          const jobs = query.state.data
          const hasActive = jobs?.some(j => j.status === 'pending' || j.status === 'processing')
          return hasActive ? 3000 : false
        }
      : undefined,
  })
}

// Hook to get a specific import job (with optional polling)
export function useImportJob(
  jobId: string | null,
  options?: { refetchInterval?: number | false }
) {
  const { session } = useAuthStore()

  return useQuery<ImportJob>({
    queryKey: ['import-job', jobId],
    queryFn: async () => {
      if (!session?.access_token || !jobId) {
        throw new Error('No access token or job ID')
      }

      const response = await axios.get(`${API_URL}/data/imports/${jobId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      return response.data
    },
    enabled: !!session?.access_token && !!jobId,
    refetchInterval: options?.refetchInterval,
  })
}

// Hook for file upload mutation with progress tracking
export function useUploadCSV(onProgress?: (progress: number) => void) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, Error, File>({
    mutationFn: async (file: File) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      if (!activeTenant?.id) {
        throw new Error('No tenant selected')
      }

      const formData = new FormData()
      formData.append('file', file)

      // Include tenant_id as query parameter so operators upload to the correct tenant
      const response = await axios.post(
        `${API_URL}/data/upload?tenant_id=${activeTenant.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total && onProgress) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(percent)
            }
          },
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}

// Hook for data health check
export function useDataHealth() {
  const { session, profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  return useQuery<DataHealthResponse>({
    queryKey: ['data-health', activeTenant?.id ?? profile?.tenant_id],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.get(`${API_URL}/data/health`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      return response.data
    },
    // Owners have their tenant_id in profile even before activeTenant is set
    enabled: !!session?.access_token && !!(activeTenant || profile?.tenant_id),
    staleTime: 1000 * 60, // 1 minute
  })
}

// Hook to list item exclusions
export function useItemExclusions() {
  const { session, profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  return useQuery<ItemExclusion[]>({
    queryKey: ['item-exclusions', activeTenant?.id],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (profile?.role === 'operator' && activeTenant?.id) {
        params.tenant_id = activeTenant.id
      }

      const response = await axios.get(`${API_URL}/data/item-exclusions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        params,
      })
      return response.data
    },
    enabled: !!session?.access_token && (profile?.role !== 'operator' || !!activeTenant),
  })
}

// Hook to fetch exclusion suggestions
export function useItemExclusionSuggestions(options?: {
  maxQuantity?: number
  maxRevenue?: number
  limit?: number
}) {
  const { session, profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  return useQuery<ItemExclusionSuggestionsResponse>({
    queryKey: [
      'item-exclusion-suggestions',
      activeTenant?.id,
      options?.maxQuantity,
      options?.maxRevenue,
      options?.limit,
    ],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string | number> = {}
      if (profile?.role === 'operator' && activeTenant?.id) {
        params.tenant_id = activeTenant.id
      }
      if (typeof options?.maxQuantity === 'number') {
        params.max_quantity = options.maxQuantity
      }
      if (typeof options?.maxRevenue === 'number') {
        params.max_revenue = options.maxRevenue
      }
      if (typeof options?.limit === 'number') {
        params.limit = options.limit
      }

      const response = await axios.get(`${API_URL}/data/item-exclusions/suggestions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        params,
      })
      return response.data
    },
    enabled: !!session?.access_token && (profile?.role !== 'operator' || !!activeTenant),
  })
}

// Response type for cancel job
export interface CancelJobResponse {
  success: boolean
  job_id: string
  transactions_deleted: number
  message: string
}

// Hook for cancelling an import job
export function useCancelImportJob() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<CancelJobResponse, Error, string>({
    mutationFn: async (jobId: string) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post(
        `${API_URL}/data/imports/${jobId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      return response.data
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['import-job', data.job_id] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
    },
  })
}

// Hook to add a new item exclusion
export function useAddItemExclusion() {
  const { session, profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation<ItemExclusion, Error, { item_name: string; reason?: string }>({
    mutationFn: async (payload) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (profile?.role === 'operator' && activeTenant?.id) {
        params.tenant_id = activeTenant.id
      }

      const response = await axios.post(
        `${API_URL}/data/item-exclusions`,
        payload,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params,
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-exclusions'] })
      queryClient.invalidateQueries({ queryKey: ['item-exclusion-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-categories'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-menu-engineering'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-category-items'] })
    },
  })
}

// Hook to delete an item exclusion
export function useDeleteItemExclusion() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean; deleted_id: string }, Error, string>({
    mutationFn: async (exclusionId: string) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.delete(
        `${API_URL}/data/item-exclusions/${exclusionId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-exclusions'] })
      queryClient.invalidateQueries({ queryKey: ['item-exclusion-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-categories'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-menu-engineering'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-category-items'] })
    },
  })
}

// Hook for deleting a completed import job and its transactions
export function useDeleteImportJob() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<CancelJobResponse, Error, string>({
    mutationFn: async (jobId: string) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post(
        `${API_URL}/data/imports/${jobId}/delete`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )
      return response.data
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['import-job', data.job_id] })
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      // Also invalidate menu items since they get regenerated
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    },
  })
}
