import { create } from 'zustand'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface DateRange {
  start: Date
  end: Date
}

interface FilterState {
  dateRange: DateRange | null
  branches: string[]
  categories: string[]
  availableBranches: string[]
  availableCategories: string[]
  isLoading: boolean

  setDateRange: (range: DateRange | null) => void
  setBranches: (branches: string[]) => void
  setCategories: (categories: string[]) => void
  fetchFilterOptions: (accessToken: string, tenantId?: string) => Promise<void>
  clearFilters: () => void
}

export const useFilterStore = create<FilterState>()((set) => ({
  dateRange: null,
  branches: [],
  categories: [],
  availableBranches: [],
  availableCategories: [],
  isLoading: false,

  setDateRange: (range) => set({ dateRange: range }),

  setBranches: (branches) => set({ branches }),

  setCategories: (categories) => set({ categories }),

  fetchFilterOptions: async (accessToken: string, tenantId?: string) => {
    set({ isLoading: true })
    try {
      const headers = { Authorization: `Bearer ${accessToken}` }
      const params = tenantId ? { tenant_id: tenantId } : {}

      const [branchesRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/data/branches`, { headers, params }),
        axios.get(`${API_URL}/data/categories`, { headers, params }),
      ])

      set({
        availableBranches: branchesRes.data.branches || [],
        availableCategories: categoriesRes.data.categories || [],
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to fetch filter options:', error)
      set({ isLoading: false })
    }
  },

  clearFilters: () =>
    set({
      dateRange: null,
      branches: [],
      categories: [],
    }),
}))

// URL param helpers - used by components
export function filtersToSearchParams(state: Pick<FilterState, 'dateRange' | 'branches' | 'categories'>): URLSearchParams {
  const params = new URLSearchParams()

  if (state.dateRange) {
    const formatLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    params.set('start', formatLocal(state.dateRange.start))
    params.set('end', formatLocal(state.dateRange.end))
  }

  if (state.branches.length > 0) {
    params.set('branches', state.branches.join(','))
  }

  if (state.categories.length > 0) {
    params.set('categories', state.categories.join(','))
  }

  return params
}

export function searchParamsToFilters(params: URLSearchParams): Partial<FilterState> {
  const result: Partial<FilterState> = {}

  const start = params.get('start')
  const end = params.get('end')
  if (start && end) {
    result.dateRange = {
      start: new Date(start),
      end: new Date(end),
    }
  }

  const branches = params.get('branches')
  if (branches) {
    result.branches = branches.split(',')
  }

  const categories = params.get('categories')
  if (categories) {
    result.categories = categories.split(',')
  }

  return result
}
