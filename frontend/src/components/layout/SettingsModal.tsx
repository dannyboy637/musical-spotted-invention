import { X } from 'lucide-react'
import {
  useSettingsStore,
  AVAILABLE_KPIS,
  DATE_RANGE_OPTIONS,
  NUMBER_FORMAT_OPTIONS,
  THEME_OPTIONS,
  TABLE_ROWS_OPTIONS,
} from '../../stores/settingsStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    defaultDateRange,
    enabledKPIs,
    numberFormat,
    theme,
    tableRowsPerPage,
    setDefaultDateRange,
    toggleKPI,
    setNumberFormat,
    setTheme,
    setTableRowsPerPage,
    resetToDefaults,
  } = useSettingsStore()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Default Date Range */}
            <section>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Default Date Range</h3>
              <div className="flex flex-wrap gap-2">
                {DATE_RANGE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      defaultDateRange === option.value
                        ? 'bg-navy-50 border-navy-300 text-navy-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dateRange"
                      value={option.value}
                      checked={defaultDateRange === option.value}
                      onChange={() => setDefaultDateRange(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Dashboard KPIs */}
            <section>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dashboard KPIs</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select up to 4 KPIs to display on the dashboard</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_KPIS.map((kpi) => {
                  const isEnabled = enabledKPIs.includes(kpi.id)
                  const canToggle = isEnabled ? enabledKPIs.length > 1 : enabledKPIs.length < 4
                  return (
                    <label
                      key={kpi.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        isEnabled
                          ? 'bg-navy-50 border-navy-300'
                          : canToggle
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => canToggle && toggleKPI(kpi.id)}
                        disabled={!canToggle}
                        className="w-4 h-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                      />
                      <span className={`text-sm ${isEnabled ? 'text-navy-700' : 'text-slate-600'}`}>
                        {kpi.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* Number Format */}
            <section>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Number Format</h3>
              <div className="flex flex-wrap gap-2">
                {NUMBER_FORMAT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      numberFormat === option.value
                        ? 'bg-navy-50 border-navy-300 text-navy-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="numberFormat"
                      value={option.value}
                      checked={numberFormat === option.value}
                      onChange={() => setNumberFormat(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm">
                      {option.example} <span className="text-slate-400">({option.label})</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Theme */}
            <section>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme</h3>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      theme === option.value
                        ? 'bg-navy-50 border-navy-300 text-navy-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={theme === option.value}
                      onChange={() => setTheme(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Table Rows Per Page */}
            <section>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Table Rows Per Page</h3>
              <div className="flex flex-wrap gap-2">
                {TABLE_ROWS_OPTIONS.map((rows) => (
                  <label
                    key={rows}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      tableRowsPerPage === rows
                        ? 'bg-navy-50 border-navy-300 text-navy-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tableRows"
                      value={rows}
                      checked={tableRowsPerPage === rows}
                      onChange={() => setTableRowsPerPage(rows)}
                      className="sr-only"
                    />
                    <span className="text-sm">{rows}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-xl">
            <button
              onClick={resetToDefaults}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Reset to defaults
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
