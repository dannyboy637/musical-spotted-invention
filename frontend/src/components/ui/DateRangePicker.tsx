import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Calendar, ChevronDown, X } from 'lucide-react'
import 'react-day-picker/style.css'

interface DateRangePickerProps {
  value: { start: Date; end: Date } | null
  onChange: (range: { start: Date; end: Date } | null) => void
}

const presets = [
  { label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: 'This month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  {
    label: 'Last month',
    getValue: () => ({
      start: startOfMonth(subMonths(new Date(), 1)),
      end: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>(
    value ? { from: value.start, to: value.end } : undefined
  )
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync internal state with prop
  useEffect(() => {
    setRange(value ? { from: value.start, to: value.end } : undefined)
  }, [value])

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange)
    if (selectedRange?.from && selectedRange?.to) {
      onChange({ start: selectedRange.from, end: selectedRange.to })
    }
  }

  const handlePreset = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue()
    setRange({ from: start, to: end })
    onChange({ start, end })
    setIsOpen(false)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRange(undefined)
    onChange(null)
  }

  const displayValue = () => {
    if (!value) return 'All Time'
    return `${format(value.start, 'MMM d, yyyy')} - ${format(value.end, 'MMM d, yyyy')}`
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        Date Range
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className={value ? 'text-slate-800' : 'text-slate-400'}>{displayValue()}</span>
        </div>

        <div className="flex items-center gap-1">
          {value && (
            <button onClick={clear} className="p-0.5 text-slate-400 hover:text-slate-600 rounded">
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
          <div className="flex gap-4">
            {/* Presets */}
            <div className="flex flex-col gap-1 border-r border-slate-200 pr-4">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Quick Select
              </span>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset.getValue)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded text-left whitespace-nowrap transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="rdp-custom">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={handleSelect}
                numberOfMonths={2}
                showOutsideDays={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
