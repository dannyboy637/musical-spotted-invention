import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
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

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent transition-colors"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>

        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
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
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = selected.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-navy-50' : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'bg-navy-700 border-navy-700 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </div>
                  <span className="truncate">{option}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
