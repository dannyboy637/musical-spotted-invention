import { X, Bell } from 'lucide-react'
import {
  useSettingsStore,
  AVAILABLE_KPIS,
  DATE_RANGE_OPTIONS,
  NUMBER_FORMAT_OPTIONS,
  THEME_OPTIONS,
  TABLE_ROWS_OPTIONS,
} from '../../stores/settingsStore'
import { useAuthStore } from '../../stores/authStore'
import { useAlertSettings, useUpdateAlertSettings } from '../../hooks/useAlerts'
import { Spinner } from '../ui/Spinner'

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

  const { profile } = useAuthStore()
  const isOwnerOrOperator = profile?.role === 'owner' || profile?.role === 'operator'

  // Alert settings (only loaded for owner/operator)
  const { data: alertSettings, isLoading: alertSettingsLoading } = useAlertSettings()
  const updateAlertSettings = useUpdateAlertSettings()

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

            {/* Alert Settings (Owner/Operator only) */}
            {isOwnerOrOperator && (
              <section className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Alert Thresholds</h3>
                </div>
                {alertSettingsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                ) : alertSettings ? (
                  <div className="space-y-4">
                    {/* Revenue Drop Threshold */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Revenue drop alert threshold
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={alertSettings.revenue_drop_pct}
                          onChange={(e) =>
                            updateAlertSettings.mutate({ revenue_drop_pct: parseInt(e.target.value) })
                          }
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-12 text-right">
                          {alertSettings.revenue_drop_pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Alert when revenue drops by this percentage week-over-week
                      </p>
                    </div>

                    {/* Item Spike Threshold */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Item sales spike threshold
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="5"
                          value={alertSettings.item_spike_pct}
                          onChange={(e) =>
                            updateAlertSettings.mutate({ item_spike_pct: parseInt(e.target.value) })
                          }
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-12 text-right">
                          {alertSettings.item_spike_pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Alert when an item's sales spike by this percentage
                      </p>
                    </div>

                    {/* Item Crash Threshold */}
                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Item sales crash threshold
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="5"
                          value={alertSettings.item_crash_pct}
                          onChange={(e) =>
                            updateAlertSettings.mutate({ item_crash_pct: parseInt(e.target.value) })
                          }
                          className="flex-1"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-12 text-right">
                          {alertSettings.item_crash_pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Alert when an item's sales drop by this percentage
                      </p>
                    </div>

                    {/* Quadrant Alerts Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Quadrant change alerts
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Alert when items move to Star or Dog quadrants
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alertSettings.quadrant_alerts_enabled}
                          onChange={(e) =>
                            updateAlertSettings.mutate({ quadrant_alerts_enabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-navy-300 dark:peer-focus:ring-navy-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-navy-600"></div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Unable to load alert settings
                  </p>
                )}
              </section>
            )}
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
