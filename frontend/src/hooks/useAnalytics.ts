import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useTenantStore } from '../stores/tenantStore'
import { useFilterStore } from '../stores/filterStore'
import type { DateRange } from '../stores/filterStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Types for API responses
export interface OverviewData {
  total_revenue: number
  total_transactions: number
  unique_receipts: number
  avg_ticket: number
  unique_items: number
  period_growth: number | null
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface MenuEngineeringItem {
  item_name: string
  category: string
  macro_category: string
  quadrant: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
  total_quantity: number
  total_revenue: number
  avg_price: number
  order_count: number
  is_core_menu: boolean
  is_current_menu: boolean
  first_sale_date: string | null
  last_sale_date: string | null
  cost_cents: number | null
  cost_percentage: number | null
}

export interface MenuEngineeringData {
  items: MenuEngineeringItem[]
  quadrant_summary: Record<string, number>
  median_quantity: number
  median_price: number
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface DaypartData {
  daypart: 'breakfast' | 'lunch' | 'dinner' | 'late_night'
  revenue: number
  transactions: number
  quantity: number
  avg_ticket: number
  percentage_of_total: number
}

export interface DaypartingData {
  dayparts: DaypartData[]
  peak_daypart: string
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface HeatmapDataPoint {
  day: number // 0-6 (Mon-Sun)
  hour: number // 0-23
  revenue: number
  transactions: number
}

export interface HourlyHeatmapData {
  data: HeatmapDataPoint[]
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface CategoryData {
  category: string
  macro_category: string
  revenue: number
  quantity: number
  item_count: number
  avg_price: number
  percentage_of_revenue: number
}

export interface CategoriesData {
  categories: CategoryData[]
  macro_totals: Record<string, { revenue: number; quantity: number; item_count: number }>
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface CategoryItemData {
  item_name: string
  quantity: number
  revenue: number
  avg_price: number
  percentage_of_category: number
}

export interface CategoryItemsData {
  category: string
  items: CategoryItemData[]
  total_items: number
  total_revenue: number
  total_quantity: number
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface BranchCategoryData {
  branch: string
  revenue: number
  quantity: number
  avg_price: number
  item_count: number
  percentage_of_branch: number
  top_item: string
}

export interface CategoryByBranchData {
  category: string
  branches: BranchCategoryData[]
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface BundlePair {
  item_a: string
  item_b: string
  frequency: number
  support: number
}

export interface BundlesData {
  pairs: BundlePair[]
  total_receipts_analyzed: number
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface PerformanceData {
  summary: {
    total_revenue: number
    total_transactions: number
    avg_ticket: number
  }
  trends: {
    daily_avg: number
    best_day: { date: string; revenue: number }
    worst_day: { date: string; revenue: number }
    best_day_of_week: string
    worst_day_of_week: string
  }
  branches: Array<{
    name: string
    revenue: number
    transactions: number
    avg_ticket: number
  }> | null
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface TrendDataPoint {
  date?: string
  week?: string
  month?: string
  revenue: number
  transactions: number
}

export interface PerformanceTrendsData {
  daily: TrendDataPoint[]
  weekly: TrendDataPoint[]
  monthly: TrendDataPoint[]
  growth_metrics: {
    month_over_month: number | null
    week_over_week: number | null
  }
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface BranchData {
  name: string
  revenue: number
  percentage_of_total: number
  transactions: number
  avg_ticket: number
  top_items: Array<{ item: string; quantity: number }>
  category_breakdown: Record<string, number>
}

export interface PerformanceBranchesData {
  branches: BranchData[]
  comparison_metrics: {
    highest_revenue: string
    lowest_revenue: string
    revenue_spread: number
    highest_avg_ticket: string
  }
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface DayOfWeekAverage {
  day: number // 0=Monday, 6=Sunday
  day_name: string
  avg_revenue: number
  avg_transactions: number
  total_days: number
}

export interface SameDayDataPoint {
  date: string
  day_name: string
  revenue: number
  transactions: number
}

export interface DayOfWeekData {
  daily_averages: DayOfWeekAverage[]
  same_day_trend: SameDayDataPoint[]
  best_day: { day_name: string; avg_revenue: number }
  worst_day: { day_name: string; avg_revenue: number }
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface YearOverYearPeriod {
  year: number
  month: number
  month_name: string
  revenue: number
  transactions: number
  avg_ticket: number
}

export interface YearOverYearData {
  periods: YearOverYearPeriod[]
  growth_yoy: number | null
  month: number
  month_name: string
  filters_applied: Record<string, unknown>
  generated_at: string
}

// Helper to build query params from filters
function buildFilterParams(
  dateRange: DateRange | null,
  branches: string[],
  categories: string[],
  tenantId?: string
): Record<string, string> {
  const params: Record<string, string> = {}

  if (tenantId) {
    params.tenant_id = tenantId
  }

  if (dateRange) {
    params.start_date = dateRange.start.toISOString().split('T')[0]
    params.end_date = dateRange.end.toISOString().split('T')[0]
  }

  if (branches.length > 0) {
    params.branches = branches.join(',')
  }

  if (categories.length > 0) {
    params.categories = categories.join(',')
  }

  return params
}

// Custom hook factory for analytics endpoints
function useAnalyticsQuery<T>(
  endpoint: string,
  queryKeyBase: string,
  options?: {
    extraParams?: Record<string, string | number | boolean>
    enabled?: boolean
  }
) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { dateRange, branches, categories } = useFilterStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<T>({
    queryKey: [queryKeyBase, tenantId, dateRange, branches, categories, options?.extraParams],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params = {
        ...buildFilterParams(dateRange, branches, categories, tenantId),
        ...options?.extraParams,
      }

      const response = await axios.get<T>(`${API_URL}/api/analytics/${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken && (options?.enabled ?? true),
  })
}

// Individual hooks for each endpoint
export function useOverview() {
  return useAnalyticsQuery<OverviewData>('overview', 'analytics-overview')
}

export function useMenuEngineering(options?: {
  coreOnly?: boolean
  currentOnly?: boolean
  macroCategory?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minQuantity?: number | null
}) {
  return useAnalyticsQuery<MenuEngineeringData>('menu-engineering', 'analytics-menu-engineering', {
    extraParams: {
      ...(options?.coreOnly !== undefined && { core_only: options.coreOnly }),
      ...(options?.currentOnly !== undefined && { current_only: options.currentOnly }),
      ...(options?.macroCategory && { macro_category: options.macroCategory }),
      ...(options?.minPrice != null && { min_price: options.minPrice }),
      ...(options?.maxPrice != null && { max_price: options.maxPrice }),
      ...(options?.minQuantity != null && { min_quantity: options.minQuantity }),
    },
  })
}

export function useDayparting() {
  return useAnalyticsQuery<DaypartingData>('dayparting', 'analytics-dayparting')
}

export function useHourlyHeatmap() {
  return useAnalyticsQuery<HourlyHeatmapData>('hourly-heatmap', 'analytics-hourly-heatmap')
}

export function useCategories(options?: { includeExcluded?: boolean }) {
  return useAnalyticsQuery<CategoriesData>('categories', 'analytics-categories', {
    extraParams: options?.includeExcluded ? { include_excluded: true } : undefined,
  })
}

export function useCategoryItems(category: string | null) {
  return useAnalyticsQuery<CategoryItemsData>(
    'category-items',
    `analytics-category-items-${category}`,
    {
      enabled: !!category,
      extraParams: { category: category || '' },
    }
  )
}

export function useCategoryByBranch(category: string | null) {
  return useAnalyticsQuery<CategoryByBranchData>(
    'category-by-branch',
    `analytics-category-by-branch-${category}`,
    {
      enabled: !!category,
      extraParams: { category: category || '' },
    }
  )
}

export function useBundles(options?: { minFrequency?: number; limit?: number }) {
  return useAnalyticsQuery<BundlesData>('bundles', 'analytics-bundles', {
    extraParams: {
      ...(options?.minFrequency !== undefined && { min_frequency: options.minFrequency }),
      ...(options?.limit !== undefined && { limit: options.limit }),
    },
  })
}

export function usePerformance() {
  return useAnalyticsQuery<PerformanceData>('performance', 'analytics-performance')
}

export function usePerformanceTrends() {
  return useAnalyticsQuery<PerformanceTrendsData>('performance/trends', 'analytics-performance-trends')
}

export function usePerformanceBranches() {
  return useAnalyticsQuery<PerformanceBranchesData>('performance/branches', 'analytics-performance-branches')
}

export function useDayOfWeek(options?: { dayFilter?: number }) {
  return useAnalyticsQuery<DayOfWeekData>('day-of-week', 'analytics-day-of-week', {
    extraParams: {
      ...(options?.dayFilter !== undefined && { day_filter: options.dayFilter }),
    },
  })
}

export function useYearOverYear(options: { month: number }) {
  return useAnalyticsQuery<YearOverYearData>('year-over-year', 'analytics-year-over-year', {
    extraParams: {
      month: options.month,
    },
    enabled: options.month >= 1 && options.month <= 12,
  })
}

// Recommendations-specific hooks that bypass global filters
// These accept explicit date range and branch parameters

export function useRecommendationMenuEngineering(options: {
  startDate: string
  endDate: string
  branch?: string | null
}) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<MenuEngineeringData>({
    queryKey: ['recommendations-menu-engineering', tenantId, options.startDate, options.endDate, options.branch],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string> = {
        start_date: options.startDate,
        end_date: options.endDate,
      }
      if (tenantId) params.tenant_id = tenantId
      if (options.branch) params.branches = options.branch

      const response = await axios.get<MenuEngineeringData>(`${API_URL}/api/analytics/menu-engineering`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken && !!tenantId,
  })
}

export function useRecommendationBundles(options: {
  startDate: string
  endDate: string
  branch?: string | null
  minFrequency?: number
}) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<BundlesData>({
    queryKey: ['recommendations-bundles', tenantId, options.startDate, options.endDate, options.branch, options.minFrequency],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string | number> = {
        start_date: options.startDate,
        end_date: options.endDate,
      }
      if (tenantId) params.tenant_id = tenantId
      if (options.branch) params.branches = options.branch
      if (options.minFrequency !== undefined) params.min_frequency = options.minFrequency

      const response = await axios.get<BundlesData>(`${API_URL}/api/analytics/bundles`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken && !!tenantId,
  })
}

// Mutation hook for regenerating menu items
export function useRegenerateMenuItems() {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('No access token')
      }

      const response = await axios.post<{ status: string; menu_items_updated: number }>(
        `${API_URL}/data/menu-items/regenerate`,
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          params: activeTenant ? { tenant_id: activeTenant.id } : undefined,
        }
      )

      return response.data
    },
    onSuccess: () => {
      // Invalidate menu engineering queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['analytics-menu-engineering'] })
    },
  })
}


// ============================================
// MOVEMENT ANALYTICS HOOKS
// Historical analysis for quadrant changes, YoY, seasonal trends
// ============================================

export interface QuadrantMovement {
  item_name: string
  month: string
  quadrant: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
  total_quantity: number
  avg_price: number
  total_revenue: number
}

export interface QuadrantTimelineData {
  movements: QuadrantMovement[]
  summary: {
    star_count: number
    plowhorse_count: number
    puzzle_count: number
    dog_count: number
    total_items: number
  }
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface SeasonalDataPoint {
  month: number
  month_name: string
  avg_revenue: number
  avg_transactions: number
  year_count: number
}

export interface SeasonalTrendsData {
  monthly_averages: SeasonalDataPoint[]
  peak_month: { month_name: string; avg_revenue: number }
  low_month: { month_name: string; avg_revenue: number }
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface ItemHistoryDataPoint {
  month: string
  quantity: number
  revenue: number
  avg_price: number
  quadrant: string
}

export interface ItemHistoryData {
  item_name: string
  history: ItemHistoryDataPoint[]
  current_quadrant: string
  quadrant_changes: number
  filters_applied: Record<string, unknown>
  generated_at: string
}

export interface YoYSummaryMonth {
  month: number
  month_name: string
  current_year: number
  current_revenue: number
  prior_year: number | null
  prior_revenue: number | null
  yoy_change_pct: number | null
}

export interface YoYSummaryData {
  months: YoYSummaryMonth[]
  total_current_revenue: number
  total_prior_revenue: number | null
  overall_yoy_change_pct: number | null
  current_year: number
  prior_year: number | null
  filters_applied: Record<string, unknown>
  generated_at: string
}

// Helper for movement analytics that don't use global date filters
function useMovementQuery<T>(
  endpoint: string,
  queryKeyBase: string,
  options?: {
    extraParams?: Record<string, string | number | boolean>
    enabled?: boolean
  }
) {
  const { session } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { branches, categories } = useFilterStore()

  const accessToken = session?.access_token
  const tenantId = activeTenant?.id

  return useQuery<T>({
    queryKey: [queryKeyBase, tenantId, branches, categories, options?.extraParams],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('No access token')
      }

      const params: Record<string, string | number | boolean> = {}
      if (tenantId) params.tenant_id = tenantId
      if (branches.length > 0) params.branches = branches.join(',')
      if (categories.length > 0) params.categories = categories.join(',')
      if (options?.extraParams) {
        Object.assign(params, options.extraParams)
      }

      const response = await axios.get<T>(`${API_URL}/api/analytics/${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      })

      return response.data
    },
    enabled: !!accessToken && (options?.enabled ?? true),
  })
}

export function useQuadrantTimeline(options?: { itemName?: string }) {
  return useAnalyticsQuery<QuadrantTimelineData>('movements/quadrant-timeline', 'movements-quadrant-timeline', {
    extraParams: options?.itemName ? { item_name: options.itemName } : undefined,
  })
}

export function useYoYSummary() {
  return useMovementQuery<YoYSummaryData>('movements/yoy-summary', 'movements-yoy-summary')
}

export function useSeasonalTrends() {
  return useMovementQuery<SeasonalTrendsData>('movements/seasonal', 'movements-seasonal')
}

export function useItemHistory(itemName: string | null) {
  return useMovementQuery<ItemHistoryData>(
    'movements/item-history',
    `movements-item-history-${itemName}`,
    {
      enabled: !!itemName,
      extraParams: itemName ? { item_name: itemName } : undefined,
    }
  )
}
