import { useState, useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrencyFull } from '../../lib/chartConfig'
import { generateMockCosts, calculateMargin, getMarginStatus } from './mockCostData'

interface CostInputTableProps {
  onCostChange: (itemName: string, costCents: number) => void
  costOverrides: Record<string, number>
  useMockCosts: boolean
}

export function CostInputTable({ onCostChange, costOverrides, useMockCosts }: CostInputTableProps) {
  const { data, isLoading, error, refetch } = useMenuEngineering()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'margin'>('name')

  // Apply mock costs and user overrides
  const itemsWithCosts = useMemo(() => {
    if (!data?.items) return []

    const withMockCosts = useMockCosts ? generateMockCosts(data.items) : data.items
    return withMockCosts.map((item) => ({
      ...item,
      cost_cents: costOverrides[item.item_name] ?? item.cost_cents,
    }))
  }, [data, costOverrides, useMockCosts])

  // Filter and sort
  const filteredItems = useMemo(() => {
    let items = itemsWithCosts

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      items = items.filter(
        (item) =>
          item.item_name.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)
      )
    }

    items.sort((a, b) => {
      if (sortBy === 'margin') {
        const marginA = calculateMargin(a.avg_price, a.cost_cents || 0)
        const marginB = calculateMargin(b.avg_price, b.cost_cents || 0)
        return marginA - marginB
      }
      return a.item_name.localeCompare(b.item_name)
    })

    return items
  }, [itemsWithCosts, searchTerm, sortBy])

  const handleCostInput = (item: MenuEngineeringItem, value: string) => {
    // Parse peso input (e.g., "150.00" -> 15000 cents)
    const pesos = parseFloat(value)
    if (!isNaN(pesos)) {
      onCostChange(item.item_name, Math.round(pesos * 100))
    }
  }

  return (
    <ChartContainer
      title="Cost Input"
      subtitle="Enter your actual food costs"
      loading={isLoading}
      empty={filteredItems.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No items found"
      skeletonType="bar"
    >
      <div className="space-y-4 px-1">
        {/* Search and Sort */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'margin')}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          >
            <option value="name">Sort by Name</option>
            <option value="margin">Sort by Margin (Low First)</option>
          </select>
        </div>

        {/* Table */}
        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                  Avg Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                  Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const cost = item.cost_cents || 0
                const margin = calculateMargin(item.avg_price, cost)
                const status = getMarginStatus(margin)
                const isOverridden = item.item_name in costOverrides

                return (
                  <tr key={item.item_name} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 text-sm">
                        {item.item_name}
                      </div>
                      <div className="text-xs text-slate-500">{item.category}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">
                      {formatCurrencyFull(item.avg_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={(cost / 100).toFixed(2)}
                          onBlur={(e) => handleCostInput(item, e.target.value)}
                          className={`w-24 pl-6 pr-2 py-1 text-right text-sm border rounded ${
                            isOverridden
                              ? 'border-gold-500 bg-gold-50'
                              : 'border-slate-300'
                          } focus:ring-2 focus:ring-gold-500 focus:border-gold-500`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'good'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ChartContainer>
  )
}
