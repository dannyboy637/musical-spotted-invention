import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ===========================================
// TYPES
// ===========================================

export interface TenantHealth {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  is_active: boolean
  alert_count: number
  critical_alert_count: number
  user_count: number
  revenue_this_week: number
  revenue_trend_pct: number
  transaction_count: number
  avg_check: number
  days_since_import: number | null
  health_status: 'green' | 'yellow' | 'red'
  data_period?: 'recent' | 'all_time'
}

export interface DashboardSummary {
  total_tenants: number
  active_tenants: number
  healthy_tenants: number
  attention_needed: number
  pending_tasks: number
  overdue_tasks: number
}

export interface OperatorDashboard {
  tenants: TenantHealth[]
  summary: DashboardSummary
}

export interface SystemHealth {
  api: { status: string; message: string }
  database: { status: string; message: string }
  auth: { status: string; message: string }
}

export interface EndpointStat {
  endpoint: string
  method: string
  call_count: number
  avg_response_ms: number
  p50_response_ms: number
  p95_response_ms: number
  p99_response_ms: number
  error_count: number
  error_rate: number
}

export interface SlowEndpoint {
  endpoint: string
  method: string
  avg_response_ms: number
  p95_response_ms: number
  call_count: number
}

export interface HourlyMetric {
  hour: string
  request_count: number
  avg_response_ms: number
  error_count: number
}

export interface MetricsSummary {
  total_requests: number
  total_errors: number
  error_rate_pct: number
  avg_response_ms: number
  slow_endpoint_count: number
}

export interface ApiMetricsResponse {
  period_hours: number
  summary: MetricsSummary
  endpoint_stats: EndpointStat[]
  slow_endpoints: SlowEndpoint[]
  hourly_metrics: HourlyMetric[]
  note?: string
}

export interface ErrorLog {
  id: string
  tenant_id: string | null
  user_id: string | null
  endpoint: string
  method: string
  status_code: number
  error_message: string | null
  stack_trace: string | null
  request_body: string | null
  ip_address: string | null
  user_agent: string | null
  duration_ms: number | null
  created_at: string
}

export interface ErrorLogsResponse {
  errors: ErrorLog[]
  total: number
  limit: number
  offset: number
}

export interface SyncStatus {
  tenant_id: string
  tenant_name: string
  tenant_slug: string
  last_import_at: string | null
  status: 'completed' | 'processing' | 'failed' | 'never'
  row_count: number
  file_name: string | null
  error_message: string | null
}

export interface OperatorTask {
  id: string
  title: string
  description: string | null
  tenant_id: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'completed'
  due_date: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  tenants?: { name: string } | null
}

export interface TaskCreate {
  title: string
  description?: string
  tenant_id?: string
  priority?: 'low' | 'medium' | 'high'
  due_date?: string
}

export interface TaskUpdate {
  title?: string
  description?: string
  tenant_id?: string
  priority?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'completed'
  due_date?: string
}

export interface ConsultantNote {
  id: string
  tenant_id: string
  content: string
  is_pinned: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface NoteCreate {
  content: string
  is_pinned?: boolean
}

export interface NoteUpdate {
  content?: string
  is_pinned?: boolean
}

export interface OperatorAlert {
  id: string
  tenant_id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string | null
  created_at: string
  dismissed_at: string | null
  tenants?: { name: string; slug: string } | null
}

export interface NLQueryRequest {
  tenant_id: string
  query: string
}

export interface NLQueryResponse {
  answer: string
  query: string
  tenant_name: string
  data_used: string | null
  mock_mode: boolean
}

// ===========================================
// HOOKS
// ===========================================

// Dashboard overview
export function useOperatorDashboard() {
  const { session } = useAuthStore()

  return useQuery<OperatorDashboard>({
    queryKey: ['operator', 'dashboard'],
    queryFn: async () => {
      const response = await axios.get<OperatorDashboard>(
        `${API_URL}/api/operator/dashboard`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    enabled: !!session?.access_token,
    refetchInterval: 60 * 60 * 1000, // 1 hour
  })
}

// System health
export function useSystemHealth() {
  const { session } = useAuthStore()

  return useQuery<SystemHealth>({
    queryKey: ['operator', 'health'],
    queryFn: async () => {
      const response = await axios.get<SystemHealth>(
        `${API_URL}/api/operator/health`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    enabled: !!session?.access_token,
    refetchInterval: 60 * 1000, // 1 minute
  })
}

// API metrics
export function useApiMetrics(hours: number = 24) {
  const { session } = useAuthStore()

  return useQuery<ApiMetricsResponse>({
    queryKey: ['operator', 'metrics', hours],
    queryFn: async () => {
      const response = await axios.get<ApiMetricsResponse>(
        `${API_URL}/api/operator/metrics`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          params: { hours },
        }
      )
      return response.data
    },
    enabled: !!session?.access_token,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  })
}

// Error logs
export function useErrorLogs(options?: {
  hours?: number
  tenant_id?: string
  endpoint?: string
  limit?: number
  offset?: number
}) {
  const { session } = useAuthStore()

  return useQuery<ErrorLogsResponse>({
    queryKey: ['operator', 'errors', options],
    queryFn: async () => {
      const response = await axios.get<ErrorLogsResponse>(
        `${API_URL}/api/operator/errors`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          params: options,
        }
      )
      return response.data
    },
    enabled: !!session?.access_token,
  })
}

// Sync status
export function useSyncStatus() {
  const { session } = useAuthStore()

  return useQuery<SyncStatus[]>({
    queryKey: ['operator', 'sync-status'],
    queryFn: async () => {
      const response = await axios.get<SyncStatus[]>(
        `${API_URL}/api/operator/sync-status`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    enabled: !!session?.access_token,
  })
}

// Tasks
export function useOperatorTasks(options?: {
  status?: 'pending' | 'completed'
  tenant_id?: string
}) {
  const { session } = useAuthStore()

  return useQuery<OperatorTask[]>({
    queryKey: ['operator', 'tasks', options],
    queryFn: async () => {
      const response = await axios.get<OperatorTask[]>(
        `${API_URL}/api/operator/tasks`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          params: options,
        }
      )
      return response.data
    },
    enabled: !!session?.access_token,
  })
}

export function useCreateTask() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<OperatorTask, Error, TaskCreate>({
    mutationFn: async (task) => {
      const response = await axios.post<OperatorTask>(
        `${API_URL}/api/operator/tasks`,
        task,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
    },
  })
}

export function useUpdateTask() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<OperatorTask, Error, { id: string; updates: TaskUpdate }>({
    mutationFn: async ({ id, updates }) => {
      const response = await axios.patch<OperatorTask>(
        `${API_URL}/api/operator/tasks/${id}`,
        updates,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
    },
  })
}

export function useDeleteTask() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await axios.delete(`${API_URL}/api/operator/tasks/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
    },
  })
}

// Notes
export function useConsultantNotes(tenantId: string) {
  const { session } = useAuthStore()

  return useQuery<ConsultantNote[]>({
    queryKey: ['operator', 'notes', tenantId],
    queryFn: async () => {
      const response = await axios.get<ConsultantNote[]>(
        `${API_URL}/api/operator/notes/${tenantId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    enabled: !!session?.access_token && !!tenantId,
  })
}

export function useCreateNote() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<ConsultantNote, Error, { tenantId: string; note: NoteCreate }>({
    mutationFn: async ({ tenantId, note }) => {
      const response = await axios.post<ConsultantNote>(
        `${API_URL}/api/operator/notes/${tenantId}`,
        note,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'notes', variables.tenantId] })
    },
  })
}

export function useUpdateNote() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<ConsultantNote, Error, { id: string; tenantId: string; updates: NoteUpdate }>({
    mutationFn: async ({ id, updates }) => {
      const response = await axios.patch<ConsultantNote>(
        `${API_URL}/api/operator/notes/${id}`,
        updates,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'notes', variables.tenantId] })
    },
  })
}

export function useDeleteNote() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: string; tenantId: string }>({
    mutationFn: async ({ id }) => {
      await axios.delete(`${API_URL}/api/operator/notes/${id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'notes', variables.tenantId] })
    },
  })
}

// Tenant status
export function useUpdateTenantStatus() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation<unknown, Error, { tenantId: string; isActive: boolean }>({
    mutationFn: async ({ tenantId, isActive }) => {
      const response = await axios.patch(
        `${API_URL}/api/operator/tenants/${tenantId}/status`,
        { is_active: isActive },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

// Aggregated alerts
export function useOperatorAlerts(options?: {
  severity?: string
  tenant_id?: string
  dismissed?: boolean
  limit?: number
}) {
  const { session } = useAuthStore()

  return useQuery<OperatorAlert[]>({
    queryKey: ['operator', 'alerts', options],
    queryFn: async () => {
      const response = await axios.get<OperatorAlert[]>(
        `${API_URL}/api/operator/alerts`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          params: options,
        }
      )
      return response.data
    },
    enabled: !!session?.access_token,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  })
}

// Natural language query
export function useNaturalLanguageQuery() {
  const { session } = useAuthStore()

  return useMutation<NLQueryResponse, Error, NLQueryRequest>({
    mutationFn: async (request) => {
      const response = await axios.post<NLQueryResponse>(
        `${API_URL}/api/operator/query`,
        request,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      return response.data
    },
  })
}

// ===========================================
// HELPERS
// ===========================================

export function getHealthStatusColor(status: 'green' | 'yellow' | 'red') {
  switch (status) {
    case 'green':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    case 'yellow':
      return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' }
    case 'red':
      return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
  }
}

export function getPriorityColor(priority: 'low' | 'medium' | 'high') {
  switch (priority) {
    case 'high':
      return { bg: 'bg-red-100', text: 'text-red-700' }
    case 'medium':
      return { bg: 'bg-amber-100', text: 'text-amber-700' }
    case 'low':
      return { bg: 'bg-slate-100', text: 'text-slate-700' }
  }
}

export function formatDataFreshness(daysSinceImport: number | null): string {
  if (daysSinceImport === null) return 'Never synced'
  if (daysSinceImport === 0) return 'Today'
  if (daysSinceImport === 1) return '1 day ago'
  if (daysSinceImport < 7) return `${daysSinceImport} days ago`
  if (daysSinceImport < 14) return '1 week ago'
  return `${Math.floor(daysSinceImport / 7)} weeks ago`
}

export function formatCurrency(cents: number): string {
  return `P${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}
