import { useState, useMemo } from 'react'
import { Search, Star, TrendingUp, HelpCircle, AlertTriangle } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useQuadrantTimeline, useItemHistory } from '../../hooks/useAnalytics'
import { Spinner } from '../../components/ui/Spinner'

const QUADRANT_CONFIG = {
  Star: { icon: Star, color: 'text-gold-600', bg: 'bg-gold-50' },
  Plowhorse: { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  Puzzle: { icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
  Dog: { icon: AlertTriangle, color: 'text-slate-500', bg: 'bg-slate-50' },
} as const

function formatCurrency(value: number): string {
  return (value / 100).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function ItemHistoryPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const { data: timelineData, isLoading: timelineLoading } = useQuadrantTimeline()
  const { data: itemData, isLoading: itemLoading } = useItemHistory(selectedItem)

  const movements = timelineData?.movements ?? []

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (movements.length === 0) return []
    if (!searchQuery.trim()) return movements.slice(0, 20)

    const query = searchQuery.toLowerCase()
    return movements
      .filter((item) => item.item_name.toLowerCase().includes(query))
      .slice(0, 20)
  }, [movements, searchQuery])

  return (
    <ChartContainer
      title="Item Performance History"
      subtitle="Search and view detailed performance data for individual menu items"
      loading={timelineLoading}
      empty={!timelineData || !timelineData.movements?.length}
      emptyDescription="No menu item data available."
    >
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a menu item..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Item List */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <h4 className="text-sm font-medium text-slate-700">
              Menu Items {filteredItems.length > 0 && `(${filteredItems.length})`}
            </h4>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                {searchQuery ? 'No items match your search.' : 'No items available.'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const config = QUADRANT_CONFIG[item.quadrant as keyof typeof QUADRANT_CONFIG]
                  const Icon = config?.icon || Star
                  const isSelected = selectedItem === item.item_name

                  return (
                    <li key={item.item_name}>
                      <button
                        onClick={() => setSelectedItem(item.item_name)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-navy-50 border-l-2 border-navy-600' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {item.item_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.total_quantity.toLocaleString()} sold
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="text-xs font-medium text-slate-600">
                              {formatCurrency(item.total_revenue)}
                            </span>
                            <span className={`p-1 rounded ${config?.bg || 'bg-slate-50'}`}>
                              <Icon className={`h-4 w-4 ${config?.color || 'text-slate-500'}`} />
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Item Details */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <h4 className="text-sm font-medium text-slate-700">Item Details</h4>
          </div>
          <div className="p-4">
            {!selectedItem ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                  Select an item from the list to view its performance details.
                </p>
              </div>
            ) : itemLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : itemData ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{itemData.item_name}</h3>
                    <p className="text-sm text-slate-500">Performance Overview</p>
                  </div>
                  {(() => {
                    const config = QUADRANT_CONFIG[itemData.current_quadrant as keyof typeof QUADRANT_CONFIG]
                    const Icon = config?.icon || Star
                    return (
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-full ${config?.bg || 'bg-slate-50'}`}>
                        <Icon className={`h-4 w-4 ${config?.color || 'text-slate-500'}`} />
                        <span className={`text-sm font-medium ${config?.color || 'text-slate-500'}`}>
                          {itemData.current_quadrant}
                        </span>
                      </span>
                    )
                  })()}
                </div>

                {/* Stats Grid */}
                {itemData.history.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Total Quantity</p>
                      <p className="text-lg font-bold text-slate-900">
                        {itemData.history[0].quantity.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Total Revenue</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(itemData.history[0].revenue)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Avg Price</p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(itemData.history[0].avg_price)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Quadrant Changes</p>
                      <p className="text-lg font-bold text-slate-900">
                        {itemData.quadrant_changes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quadrant explanation */}
                <div className="bg-navy-50 rounded-lg p-4 mt-4">
                  <p className="text-sm text-navy-700">
                    {itemData.current_quadrant === 'Star' && (
                      <>This item is a <strong>Star</strong> - high in both popularity and profitability. Keep promoting it!</>
                    )}
                    {itemData.current_quadrant === 'Plowhorse' && (
                      <>This item is a <strong>Plowhorse</strong> - popular but low margin. Consider price optimization.</>
                    )}
                    {itemData.current_quadrant === 'Puzzle' && (
                      <>This item is a <strong>Puzzle</strong> - high margin but low sales. Try promotional efforts.</>
                    )}
                    {itemData.current_quadrant === 'Dog' && (
                      <>This item is a <strong>Dog</strong> - low in both popularity and profitability. Consider discontinuing or repositioning.</>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">Unable to load item details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ChartContainer>
  )
}
