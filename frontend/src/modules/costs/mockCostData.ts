import type { MenuEngineeringItem } from '../../hooks/useAnalytics'

// Generate mock costs for items (30-45% of price)
export function generateMockCosts(items: MenuEngineeringItem[]): MenuEngineeringItem[] {
  return items.map((item) => {
    // Random cost percentage between 30-45%
    const costPercentage = 30 + Math.random() * 15
    const costCents = Math.round(item.avg_price * (costPercentage / 100))

    return {
      ...item,
      cost_cents: item.cost_cents ?? costCents,
      cost_percentage: item.cost_percentage ?? costPercentage,
    }
  })
}

// Calculate margin
export function calculateMargin(price: number, cost: number): number {
  if (price === 0) return 0
  return ((price - cost) / price) * 100
}

// Margin status
export function getMarginStatus(marginPercent: number): 'good' | 'warning' | 'danger' {
  if (marginPercent >= 60) return 'good'
  if (marginPercent >= 50) return 'warning'
  return 'danger'
}
