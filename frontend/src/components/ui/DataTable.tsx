import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'

export interface Column<T> {
  key: keyof T | string
  header: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
  render?: (value: unknown, row: T, index: number) => React.ReactNode
  getValue?: (row: T) => unknown
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: keyof T
  onRowClick?: (row: T, index: number) => void
  emptyMessage?: string
  className?: string
  compact?: boolean
  paginated?: boolean
  rowClassName?: (row: T, index: number) => string
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends object>({
  columns,
  data,
  keyField,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  compact = false,
  paginated = false,
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const { tableRowsPerPage } = useSettingsStore()

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return

    const key = String(column.key)
    if (sortKey === key) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    const column = columns.find((c) => String(c.key) === sortKey)
    if (!column) return data

    return [...data].sort((a, b) => {
      const aValue = column.getValue ? column.getValue(a) : a[sortKey as keyof T]
      const bValue = column.getValue ? column.getValue(b) : b[sortKey as keyof T]

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1

      // Compare values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()
      const comparison = aStr.localeCompare(bStr)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortKey, sortDirection, columns])

  // Pagination logic
  const totalPages = paginated ? Math.ceil(sortedData.length / tableRowsPerPage) : 1
  // Reset to page 1 when current page exceeds total pages
  const effectivePage = (currentPage > totalPages && totalPages > 0) ? 1 : currentPage
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData
    const startIndex = (effectivePage - 1) * tableRowsPerPage
    return sortedData.slice(startIndex, startIndex + tableRowsPerPage)
  }, [sortedData, paginated, effectivePage, tableRowsPerPage])

  const getCellValue = (row: T, column: Column<T>): unknown => {
    if (column.getValue) {
      return column.getValue(row)
    }
    return row[column.key as keyof T]
  }

  const renderCellContent = (row: T, column: Column<T>, index: number): React.ReactNode => {
    const value = getCellValue(row, column)
    if (column.render) {
      return column.render(value, row, index)
    }
    return value as React.ReactNode
  }

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null

    const key = String(column.key)
    if (sortKey !== key) {
      return <ChevronsUpDown className="w-4 h-4 text-slate-400" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-4 h-4 text-gold-600" />
    }
    return <ChevronDown className="w-4 h-4 text-gold-600" />
  }

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center'
      case 'right':
        return 'text-right'
      default:
        return 'text-left'
    }
  }

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3'
  const headerPadding = compact ? 'px-3 py-2' : 'px-4 py-3'

  if (data.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
        <div className="p-8 text-center text-slate-500">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`${headerPadding} text-xs font-semibold text-slate-600 uppercase tracking-wider ${getAlignClass(column.align)} ${
                    column.sortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                    <span>{column.header}</span>
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((row, index) => {
              const key = keyField ? String(row[keyField]) : index
              const customRowClass = rowClassName ? rowClassName(row, index) : ''
              return (
                <tr
                  key={key}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors ${customRowClass}`}
                  onClick={() => onRowClick?.(row, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`${cellPadding} text-sm text-slate-700 ${getAlignClass(column.align)}`}
                    >
                      {renderCellContent(row, column, index)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-600">
            Showing {((effectivePage - 1) * tableRowsPerPage) + 1} to {Math.min(effectivePage * tableRowsPerPage, sortedData.length)} of {sortedData.length} items
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={effectivePage === 1}
              className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (effectivePage <= 3) {
                  pageNum = i + 1
                } else if (effectivePage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = effectivePage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      pageNum === effectivePage
                        ? 'bg-navy-600 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={effectivePage === totalPages}
              className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
