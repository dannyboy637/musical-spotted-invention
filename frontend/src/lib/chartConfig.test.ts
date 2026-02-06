import { describe, it, expect } from 'vitest'
import { formatCurrencyFull, getResponsiveMargin } from './chartConfig'

describe('chartConfig helpers', () => {
  it('formats currency with two decimals', () => {
    expect(formatCurrencyFull(12345)).toBe('₱123.45')
  })

  it('returns mobile margins for small widths', () => {
    expect(getResponsiveMargin(375)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 })
  })
})
