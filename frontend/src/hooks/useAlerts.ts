import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types
export interface Alert {
  id: string
  tenant_id: string
  type: 'revenue_drop' | 'item_spike' | 'item_crash' | 'new_star' | 'new_dog'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string | null
  data: Record<string, unknown> | null
  created_at: string
  dismissed_at: string | null
  dismissed_by: string | null
}

export interface AlertsListResponse {
  alerts: Alert[]
  total: number
  active_count: number
}

export interface AlertSettings {
  tenant_id: string
  revenue_drop_pct: number
  item_spike_pct: number
  item_crash_pct: number
  quadrant_alerts_enabled: boolean
  updated_at: string
}

export interface AlertSettingsUpdate {
  revenue_drop_pct?: number
  item_spike_pct?: number
  item_crash_pct?: number
  quadrant_alerts_enabled?: boolean
}

export interface ScanResponse {
  alerts_created: number
  scan_duration_ms: number
  message: string
}

// Fetch alerts
export function useAlerts(options?: {
  activeOnly?: boolean
  alertType?: string
  severity?: string
  limit?: number
  offset?: number
}) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<AlertsListResponse>({
    queryKey: ['alerts', tenantId, options],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string | number | boolean> = {}
      if (tenantId) params.tenant_id = tenantId
      if (options?.activeOnly) params.active_only = true
      if (options?.alertType) params.alert_type = options.alertType
      if (options?.severity) params.severity = options.severity
      if (options?.limit) params.limit = options.limit
      if (options?.offset) params.offset = options.offset

      const response = await axios.get<AlertsListResponse>(`${API_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Fetch active alerts only (for banner)
export function useActiveAlerts() {
  return useAlerts({ activeOnly: true, limit: 10 })
}

// Dismiss an alert
export function useDismissAlert() {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post(
        `${API_URL}/api/alerts/${alertId}/dismiss`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      return response.data
    },
    onSuccess: () => {
      // Invalidate alerts queries to refetch
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

// Trigger manual scan
export function useTriggerScan() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation<ScanResponse>({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (activeTenant?.id) params.tenant_id = activeTenant.id

      const response = await axios.post<ScanResponse>(
        `${API_URL}/api/alerts/scan`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params,
        }
      )

      return response.data
    },
    onSuccess: () => {
      // Invalidate alerts queries to refetch
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

// Fetch alert settings
export function useAlertSettings() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<AlertSettings>({
    queryKey: ['alert-settings', tenantId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (tenantId) params.tenant_id = tenantId

      const response = await axios.get<AlertSettings>(`${API_URL}/api/alerts/settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken,
  })
}

// Update alert settings
export function useUpdateAlertSettings() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation<AlertSettings, Error, AlertSettingsUpdate>({
    mutationFn: async (updates) => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {}
      if (activeTenant?.id) params.tenant_id = activeTenant.id

      const response = await axios.put<AlertSettings>(
        `${API_URL}/api/alerts/settings`,
        updates,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params,
        }
      )

      return response.data
    },
    onSuccess: () => {
      // Invalidate settings query to refetch
      queryClient.invalidateQueries({ queryKey: ['alert-settings'] })
    },
  })
}

// Color definitions for consistency
const ALERT_COLORS = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-200 dark:border-amber-800',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-200 dark:border-blue-800',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
}

// Helper to get severity color (legacy, for backwards compatibility)
export function getAlertSeverityColor(severity: Alert['severity']): {
  bg: string
  text: string
  border: string
} {
  return ALERT_COLORS[severity] || ALERT_COLORS.info
}

// Helper to get alert color based on type and severity
// Uses type-aware coloring for quadrant alerts
export function getAlertColor(alert: Alert): {
  bg: string
  text: string
  border: string
} {
  // Quadrant alerts use type-based coloring
  if (alert.type === 'new_star') {
    return ALERT_COLORS.success // Green for Star promotion (good)
  }
  if (alert.type === 'new_dog') {
    return ALERT_COLORS.critical // Red for Dog demotion (bad)
  }

  // Item spike is good (sales went up)
  if (alert.type === 'item_spike') {
    return ALERT_COLORS.success
  }

  // All other alerts use severity-based coloring
  return ALERT_COLORS[alert.severity] || ALERT_COLORS.info
}

// Helper to get alert type label
export function getAlertTypeLabel(type: Alert['type']): string {
  switch (type) {
    case 'revenue_drop':
      return 'Revenue Drop'
    case 'item_spike':
      return 'Item Spike'
    case 'item_crash':
      return 'Item Crash'
    case 'new_star':
      return 'New Star'
    case 'new_dog':
      return 'New Dog'
    default:
      return type
  }
}

// Helper to get alert type icon
export function getAlertTypeIcon(type: Alert['type']): string {
  switch (type) {
    case 'revenue_drop':
      return '📉'
    case 'item_spike':
      return '📈'
    case 'item_crash':
      return '📉'
    case 'new_star':
      return '⭐'
    case 'new_dog':
      return '🐕'
    default:
      return '🔔'
  }
}
