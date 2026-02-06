import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore, filtersToSearchParams, searchParamsToFilters } from '../filterStore'

describe('filterStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useFilterStore.setState({
      dateRange: null,
      branches: [],
      categories: [],
      availableBranches: [],
      availableCategories: [],
      isLoading: false,
    })
  })

  describe('initial state', () => {
    it('starts with null dateRange', () => {
      const state = useFilterStore.getState()
      expect(state.dateRange).toBeNull()
    })

    it('starts with empty branches', () => {
      const state = useFilterStore.getState()
      expect(state.branches).toEqual([])
    })

    it('starts with empty categories', () => {
      const state = useFilterStore.getState()
      expect(state.categories).toEqual([])
    })

    it('starts not loading', () => {
      const state = useFilterStore.getState()
      expect(state.isLoading).toBe(false)
    })
  })

  describe('setDateRange', () => {
    it('sets a date range', () => {
      const range = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      }
      useFilterStore.getState().setDateRange(range)
      const state = useFilterStore.getState()
      expect(state.dateRange).toEqual(range)
    })

    it('clears date range with null', () => {
      useFilterStore.getState().setDateRange({
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      })
      useFilterStore.getState().setDateRange(null)
      expect(useFilterStore.getState().dateRange).toBeNull()
    })
  })

  describe('setBranches', () => {
    it('sets selected branches', () => {
      useFilterStore.getState().setBranches(['Main', 'Downtown'])
      expect(useFilterStore.getState().branches).toEqual(['Main', 'Downtown'])
    })

    it('clears branches with empty array', () => {
      useFilterStore.getState().setBranches(['Main'])
      useFilterStore.getState().setBranches([])
      expect(useFilterStore.getState().branches).toEqual([])
    })
  })

  describe('setCategories', () => {
    it('sets selected categories', () => {
      useFilterStore.getState().setCategories(['Coffee', 'Tea'])
      expect(useFilterStore.getState().categories).toEqual(['Coffee', 'Tea'])
    })

    it('clears categories with empty array', () => {
      useFilterStore.getState().setCategories(['Coffee'])
      useFilterStore.getState().setCategories([])
      expect(useFilterStore.getState().categories).toEqual([])
    })
  })

  describe('clearFilters', () => {
    it('resets all filters to defaults', () => {
      useFilterStore.getState().setDateRange({
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      })
      useFilterStore.getState().setBranches(['Main', 'Downtown'])
      useFilterStore.getState().setCategories(['Coffee'])

      useFilterStore.getState().clearFilters()

      const state = useFilterStore.getState()
      expect(state.dateRange).toBeNull()
      expect(state.branches).toEqual([])
      expect(state.categories).toEqual([])
    })

    it('does not clear available options', () => {
      useFilterStore.setState({
        availableBranches: ['Main', 'Downtown'],
        availableCategories: ['Coffee', 'Tea'],
      })

      useFilterStore.getState().clearFilters()

      const state = useFilterStore.getState()
      expect(state.availableBranches).toEqual(['Main', 'Downtown'])
      expect(state.availableCategories).toEqual(['Coffee', 'Tea'])
    })
  })
})

describe('filtersToSearchParams', () => {
  it('returns empty params when no filters set', () => {
    const state = useFilterStore.getState()
    const params = filtersToSearchParams(state)
    expect(params.toString()).toBe('')
  })

  it('includes date range', () => {
    useFilterStore.getState().setDateRange({
      start: new Date('2025-06-01'),
      end: new Date('2025-06-30'),
    })
    const params = filtersToSearchParams(useFilterStore.getState())
    expect(params.get('start')).toBe('2025-06-01')
    expect(params.get('end')).toBe('2025-06-30')
  })

  it('includes branches', () => {
    useFilterStore.getState().setBranches(['Main', 'Downtown'])
    const params = filtersToSearchParams(useFilterStore.getState())
    expect(params.get('branches')).toBe('Main,Downtown')
  })

  it('includes categories', () => {
    useFilterStore.getState().setCategories(['Coffee', 'Tea'])
    const params = filtersToSearchParams(useFilterStore.getState())
    expect(params.get('categories')).toBe('Coffee,Tea')
  })
})

describe('searchParamsToFilters', () => {
  it('returns empty object for empty params', () => {
    const params = new URLSearchParams()
    const result = searchParamsToFilters(params)
    expect(result.dateRange).toBeUndefined()
    expect(result.branches).toBeUndefined()
    expect(result.categories).toBeUndefined()
  })

  it('parses date range', () => {
    const params = new URLSearchParams({ start: '2025-01-01', end: '2025-01-31' })
    const result = searchParamsToFilters(params)
    expect(result.dateRange).toBeDefined()
    expect(result.dateRange!.start.toISOString()).toContain('2025-01-01')
    expect(result.dateRange!.end.toISOString()).toContain('2025-01-31')
  })

  it('parses branches', () => {
    const params = new URLSearchParams({ branches: 'Main,Downtown' })
    const result = searchParamsToFilters(params)
    expect(result.branches).toEqual(['Main', 'Downtown'])
  })

  it('parses categories', () => {
    const params = new URLSearchParams({ categories: 'Coffee,Tea' })
    const result = searchParamsToFilters(params)
    expect(result.categories).toEqual(['Coffee', 'Tea'])
  })

  it('requires both start and end for dateRange', () => {
    const params = new URLSearchParams({ start: '2025-01-01' })
    const result = searchParamsToFilters(params)
    expect(result.dateRange).toBeUndefined()
  })
})
