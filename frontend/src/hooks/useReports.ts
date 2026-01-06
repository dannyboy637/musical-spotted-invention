import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types
export type ReportStatus = 'pending' | 'approved' | 'sent'
export type NarrativeStyle = 'full' | 'bullets'
export type PeriodType = 'week' | 'month' | 'quarter' | 'year'

export interface Report {
  id: string
  tenant_id: string
  tenant_name: string | null
  period_start: string
  period_end: string
  period_type: PeriodType
  status: ReportStatus
  narrative_style: NarrativeStyle
  narrative_text: string | null
  report_data: {
    period: {
      start_date: string
      end_date: string
    }
    kpis: {
      revenue: number
      transactions: number
      unique_receipts: number
      avg_check: number
      unique_items: number
      revenue_change_pct?: number
      transactions_change_pct?: number
      avg_check_change_pct?: number
    }
    top_items: Array<{
      item_name: string
      category: string
      revenue: number
      quantity: number
    }>
    gainers: Array<{
      item_name: string
      current_revenue: number
      previous_revenue: number
      change_pct: number
      change_amount: number
    }>
    decliners: Array<{
      item_name: string
      current_revenue: number
      previous_revenue: number
      change_pct: number
      change_amount: number
    }>
    alerts: Array<{
      type: string
      severity: string
      title: string
      message: string | null
      created_at: string
    }>
    generated_at: string
  }
  created_at: string
  approved_at: string | null
  sent_at: string | null
  approved_by: string | null
  recipient_email: string | null
}

export interface ReportsListResponse {
  reports: Report[]
  total: number
}

export interface GenerateReportRequest {
  tenant_id: string
  period_type?: PeriodType
  narrative_style?: NarrativeStyle
}

export interface UpdateReportRequest {
  narrative_text?: string
  narrative_style?: NarrativeStyle
}

export interface SendReportRequest {
  recipient_email?: string
}

export interface GenerateAllResponse {
  message: string
  period: {
    start_date: string
    end_date: string
  }
  generated: number
  skipped: number
  errors: Array<{ tenant_id: string; error: string }> | null
}

// Fetch reports list
export function useReports(options?: {
  tenantId?: string
  status?: ReportStatus
  limit?: number
  offset?: number
}) {
  const { session, profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  // For operators, use the active tenant filter if provided
  const tenantId = options?.tenantId || (profile?.role === 'operator' ? activeTenant?.id : undefined)

  return useQuery<ReportsListResponse>({
    queryKey: ['reports', tenantId, options?.status, options?.limit, options?.offset],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string | number> = {}
      if (tenantId) params.tenant_id = tenantId
      if (options?.status) params.status = options.status
      if (options?.limit) params.limit = options.limit
      if (options?.offset) params.offset = options.offset

      const response = await axios.get<ReportsListResponse>(`${API_URL}/api/reports`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken && profile?.role === 'operator',
  })
}

// Fetch single report
export function useReport(reportId: string | undefined) {
  const { session } = useAuthStore()
  const accessToken = session?.access_token

  return useQuery<Report>({
    queryKey: ['report', reportId],
    queryFn: async () => {
      if (!accessToken || !reportId) {
        throw new Error('No access token or report ID')
      }

      const response = await axios.get<Report>(`${API_URL}/api/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      return response.data
    },
    enabled: !!accessToken && !!reportId,
  })
}

// Generate a report
export function useGenerateReport() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<Report, Error, GenerateReportRequest>({
    mutationFn: async (data) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post<Report>(
        `${API_URL}/api/reports/generate`,
        data,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// Generate reports for all tenants
export function useGenerateAllReports() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<GenerateAllResponse, Error, { narrative_style?: NarrativeStyle }>({
    mutationFn: async (data) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (data.narrative_style) params.narrative_style = data.narrative_style

      const response = await axios.post<GenerateAllResponse>(
        `${API_URL}/api/reports/generate-all`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params,
        }
      )

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// Update a report
export function useUpdateReport() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<Report, Error, { reportId: string; data: UpdateReportRequest }>({
    mutationFn: async ({ reportId, data }) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.put<Report>(
        `${API_URL}/api/reports/${reportId}`,
        data,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.setQueryData(['report', data.id], data)
    },
  })
}

// Regenerate narrative
export function useRegenerateNarrative() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<Report, Error, { reportId: string; narrative_style?: NarrativeStyle }>({
    mutationFn: async ({ reportId, narrative_style }) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post<Report>(
        `${API_URL}/api/reports/${reportId}/regenerate`,
        { narrative_style },
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.setQueryData(['report', data.id], data)
    },
  })
}

// Approve a report
export function useApproveReport() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<{ message: string; report_id: string }, Error, string>({
    mutationFn: async (reportId) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post(
        `${API_URL}/api/reports/${reportId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
  })
}

// Send a report
export function useSendReport() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<
    { message: string; report_id: string; recipient: string; message_id: string },
    Error,
    { reportId: string; data?: SendReportRequest }
  >({
    mutationFn: async ({ reportId, data }) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post(
        `${API_URL}/api/reports/${reportId}/send`,
        data || {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['report'] })
    },
  })
}

// Delete a report
export function useDeleteReport() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<{ message: string; report_id: string }, Error, string>({
    mutationFn: async (reportId) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.delete(`${API_URL}/api/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// Helper to format currency
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Helper to get status badge color
export function getStatusColor(status: ReportStatus): {
  bg: string
  text: string
} {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-800 dark:text-amber-200',
      }
    case 'approved':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-800 dark:text-blue-200',
      }
    case 'sent':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-800 dark:text-emerald-200',
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-700',
        text: 'text-slate-800 dark:text-slate-200',
      }
  }
}

// Helper to format date range
export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (startDate.getFullYear() !== endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
  }
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}

// Helper to get period type label
export function getPeriodTypeLabel(periodType: PeriodType): string {
  switch (periodType) {
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'quarter':
      return 'Quarterly'
    case 'year':
      return 'Annual'
    default:
      return 'Weekly'
  }
}

// Helper to get period type badge color
export function getPeriodTypeColor(periodType: PeriodType): {
  bg: string
  text: string
} {
  switch (periodType) {
    case 'week':
      return {
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        text: 'text-indigo-800 dark:text-indigo-200',
      }
    case 'month':
      return {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-800 dark:text-purple-200',
      }
    case 'quarter':
      return {
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-800 dark:text-cyan-200',
      }
    case 'year':
      return {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        text: 'text-rose-800 dark:text-rose-200',
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-700',
        text: 'text-slate-800 dark:text-slate-200',
      }
  }
}
