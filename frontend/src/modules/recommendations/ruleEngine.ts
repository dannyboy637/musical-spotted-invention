import type { MenuEngineeringItem, BundlePair } from '../../hooks/useAnalytics'

// Only log in development mode
const isDev = import.meta.env.DEV
const logError = (...args: unknown[]) => isDev && console.error(...args)

export interface RuleConfig {
  // Items to promote
  promoteMinQuantity: number // Percentage of median (e.g., 100 = at median)
  promoteMinRevenue: number // Percentage of median

  // Items to cut
  cutMaxQuantity: number // Percentage of median
  cutMaxRevenue: number // Percentage of median
  cutDaysInactive: number // Days since last sale

  // Bundle thresholds
  bundleMinFrequency: number // Minimum times pair appears together
  bundleMinSupport: number // Minimum support percentage

  // Internal version for migrations
  _version?: number
}

export const defaultRuleConfig: RuleConfig = {
  promoteMinQuantity: 100, // At or above median
  promoteMinRevenue: 100,
  cutMaxQuantity: 20, // Below 20% of median
  cutMaxRevenue: 20,
  cutDaysInactive: 30,
  bundleMinFrequency: 3,  // Lowered from 10 - bundle must appear 3+ times
  bundleMinSupport: 0.5,  // Lowered from 3 - bundle must have 0.5%+ support
}

const STORAGE_KEY = 'recommendations-rule-config'
const CONFIG_VERSION = 2 // Bump when defaults change significantly

export function loadRuleConfig(): RuleConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)

      // Migrate old configs with high bundle thresholds (v1 had bundleMinFrequency: 10, bundleMinSupport: 3)
      // If stored version is older or missing, reset bundle thresholds to new defaults
      if (!parsed._version || parsed._version < CONFIG_VERSION) {
        // Reset bundle settings to new lower thresholds
        parsed.bundleMinFrequency = defaultRuleConfig.bundleMinFrequency
        parsed.bundleMinSupport = defaultRuleConfig.bundleMinSupport
        parsed._version = CONFIG_VERSION
        // Save the migrated config
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }

      return { ...defaultRuleConfig, ...parsed }
    }
  } catch (e) {
    logError('Failed to load rule config:', e)
  }
  return { ...defaultRuleConfig, _version: CONFIG_VERSION } as RuleConfig
}

export function saveRuleConfig(config: RuleConfig): void {
  try {
    const configWithVersion = { ...config, _version: CONFIG_VERSION }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configWithVersion))
  } catch (e) {
    logError('Failed to save rule config:', e)
  }
}

export interface Recommendation {
  id: string
  type: 'promote' | 'cut' | 'bundle'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  item?: MenuEngineeringItem
  itemA?: string
  itemB?: string
  metrics?: Record<string, string | number>
}

export function generateRecommendations(
  items: MenuEngineeringItem[],
  bundles: BundlePair[],
  medianQuantity: number,
  _medianRevenue: number,
  config: RuleConfig
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Items to promote (Stars that could be highlighted more)
  const stars = items.filter((item) => item.quadrant === 'Star')
  const puzzles = items.filter((item) => item.quadrant === 'Puzzle')

  // High-performing stars
  stars.slice(0, 5).forEach((item) => {
    recommendations.push({
      id: `promote-${item.item_name}`,
      type: 'promote',
      priority: 'high',
      title: `Feature ${item.item_name}`,
      description: 'This Star item has high profitability and popularity. Consider featuring it more prominently.',
      item,
      metrics: {
        'Quantity': item.total_quantity,
        'Revenue': `₱${(item.total_revenue / 100).toLocaleString()}`,
        'Quadrant': item.quadrant,
      },
    })
  })

  // Puzzles (high profit, low popularity - need promotion)
  puzzles.slice(0, 3).forEach((item) => {
    recommendations.push({
      id: `promote-puzzle-${item.item_name}`,
      type: 'promote',
      priority: 'medium',
      title: `Boost ${item.item_name}`,
      description: 'This Puzzle item is profitable but underordered. Consider staff recommendations or menu placement.',
      item,
      metrics: {
        'Avg Price': `₱${(item.avg_price / 100).toFixed(2)}`,
        'Quantity': item.total_quantity,
        'Potential': 'High margin',
      },
    })
  })

  // Items to cut (Dogs with poor performance)
  const cutThresholdQty = medianQuantity * (config.cutMaxQuantity / 100)

  const dogs = items.filter(
    (item) =>
      item.quadrant === 'Dog' &&
      item.total_quantity < cutThresholdQty
  )

  dogs.slice(0, 5).forEach((item) => {
    const daysSinceLastSale = item.last_sale_date
      ? Math.floor(
          (Date.now() - new Date(item.last_sale_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null

    const isInactive = daysSinceLastSale && daysSinceLastSale > config.cutDaysInactive

    recommendations.push({
      id: `cut-${item.item_name}`,
      type: 'cut',
      priority: isInactive ? 'high' : 'medium',
      title: `Review ${item.item_name}`,
      description: isInactive
        ? `This item hasn't sold in ${daysSinceLastSale} days. Consider removing from menu.`
        : 'Low performance Dog item. Consider repricing, repositioning, or removing.',
      item,
      metrics: {
        'Quantity': item.total_quantity,
        'Revenue': `₱${(item.total_revenue / 100).toLocaleString()}`,
        'Days Since Sale': daysSinceLastSale ?? 'Unknown',
      },
    })
  })

  // Bundle opportunities
  const highSupportBundles = bundles.filter(
    (b) =>
      b.frequency >= config.bundleMinFrequency &&
      b.support >= config.bundleMinSupport
  )

  highSupportBundles.slice(0, 5).forEach((bundle) => {
    recommendations.push({
      id: `bundle-${bundle.item_a}-${bundle.item_b}`,
      type: 'bundle',
      priority: bundle.support >= 10 ? 'high' : 'medium',
      title: `Bundle ${bundle.item_a} + ${bundle.item_b}`,
      description: `These items are frequently purchased together. Consider creating a combo or discount bundle.`,
      itemA: bundle.item_a,
      itemB: bundle.item_b,
      metrics: {
        'Frequency': bundle.frequency,
        'Support': `${bundle.support.toFixed(1)}%`,
      },
    })
  })

  return recommendations
}
