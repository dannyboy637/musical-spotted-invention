import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface MenuEngineeringFilters {
  macroCategory: string | null
  minPrice: number | null
  maxPrice: number | null
  minQuantity: number | null
}

const DEFAULTS: MenuEngineeringFilters = {
  macroCategory: 'FOOD',
  minPrice: null,
  maxPrice: null,
  minQuantity: null,
}

// URL param keys (prefixed to avoid collision with global filters)
const PARAMS = {
  macro: 'me_macro',
  minPrice: 'me_minPrice',
  maxPrice: 'me_maxPrice',
  minQty: 'me_minQty',
} as const

function parseUrlFilters(searchParams: URLSearchParams): Partial<MenuEngineeringFilters> {
  const result: Partial<MenuEngineeringFilters> = {}

  const macro = searchParams.get(PARAMS.macro)
  if (macro) {
    result.macroCategory = macro === 'ALL' ? null : macro
  }

  const minPrice = searchParams.get(PARAMS.minPrice)
  if (minPrice) {
    const parsed = parseInt(minPrice, 10)
    if (!isNaN(parsed)) result.minPrice = parsed
  }

  const maxPrice = searchParams.get(PARAMS.maxPrice)
  if (maxPrice) {
    const parsed = parseInt(maxPrice, 10)
    if (!isNaN(parsed)) result.maxPrice = parsed
  }

  const minQty = searchParams.get(PARAMS.minQty)
  if (minQty) {
    const parsed = parseInt(minQty, 10)
    if (!isNaN(parsed)) result.minQuantity = parsed
  }

  return result
}

function filtersToUrlParams(filters: MenuEngineeringFilters): Record<string, string> {
  const params: Record<string, string> = {}

  // Only set macro if it's not the default
  if (filters.macroCategory === null) {
    params[PARAMS.macro] = 'ALL'
  } else if (filters.macroCategory !== DEFAULTS.macroCategory) {
    params[PARAMS.macro] = filters.macroCategory
  }

  if (filters.minPrice != null) params[PARAMS.minPrice] = String(filters.minPrice)
  if (filters.maxPrice != null) params[PARAMS.maxPrice] = String(filters.maxPrice)
  if (filters.minQuantity != null) params[PARAMS.minQty] = String(filters.minQuantity)

  return params
}

export function useMenuEngineeringFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse initial filters from URL on mount
  const initialFilters = useMemo(() => {
    const fromUrl = parseUrlFilters(searchParams)
    // If we have URL params, use them; otherwise use defaults
    const hasUrlParams = Object.keys(fromUrl).length > 0
    return hasUrlParams ? { ...DEFAULTS, ...fromUrl } : DEFAULTS
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  const [applied, setApplied] = useState<MenuEngineeringFilters>(initialFilters)
  const [draft, setDraft] = useState<MenuEngineeringFilters>(initialFilters)

  // Sync applied filters to URL (preserve other params like global filters)
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams)

    // Clear old menu engineering params
    Object.values(PARAMS).forEach((key) => newParams.delete(key))

    // Set new params (only non-default values)
    const filterParams = filtersToUrlParams(applied)
    Object.entries(filterParams).forEach(([key, value]) => {
      newParams.set(key, value)
    })

    // Only update if actually changed
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true })
    }
  }, [applied, searchParams, setSearchParams])

  const hasUnappliedChanges = useMemo(() => {
    return (
      draft.macroCategory !== applied.macroCategory ||
      draft.minPrice !== applied.minPrice ||
      draft.maxPrice !== applied.maxPrice ||
      draft.minQuantity !== applied.minQuantity
    )
  }, [draft, applied])

  const applyFilters = useCallback(() => {
    setApplied(draft)
  }, [draft])

  const clearFilters = useCallback(() => {
    setDraft(DEFAULTS)
    setApplied(DEFAULTS)
  }, [])

  // Helper to update individual draft fields
  const updateDraft = useCallback((updates: Partial<MenuEngineeringFilters>) => {
    setDraft((prev) => ({ ...prev, ...updates }))
  }, [])

  return {
    applied,
    draft,
    setDraft,
    updateDraft,
    applyFilters,
    clearFilters,
    hasUnappliedChanges,
  }
}
