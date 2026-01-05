import { useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { defaultRuleConfig } from './ruleEngine'
import type { RuleConfig } from './ruleEngine'

interface RuleSettingsProps {
  config: RuleConfig
  onSave: (config: RuleConfig) => void
  onClose: () => void
}

export function RuleSettings({ config, onSave, onClose }: RuleSettingsProps) {
  const [localConfig, setLocalConfig] = useState<RuleConfig>(config)

  const handleChange = (key: keyof RuleConfig, value: number) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleReset = () => {
    setLocalConfig(defaultRuleConfig)
  }

  const handleSave = () => {
    onSave(localConfig)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-navy-900">Rule Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Promote Rules */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                Items to Promote
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Min Quantity (% of median)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={localConfig.promoteMinQuantity}
                    onChange={(e) =>
                      handleChange('promoteMinQuantity', parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Min Revenue (% of median)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={localConfig.promoteMinRevenue}
                    onChange={(e) =>
                      handleChange('promoteMinRevenue', parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
              </div>
            </div>

            {/* Cut Rules */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                Items to Cut
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Max Quantity (% of median)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={localConfig.cutMaxQuantity}
                    onChange={(e) =>
                      handleChange('cutMaxQuantity', parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Days Inactive (threshold)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={localConfig.cutDaysInactive}
                    onChange={(e) =>
                      handleChange('cutDaysInactive', parseInt(e.target.value) || 30)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
              </div>
            </div>

            {/* Bundle Rules */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3">
                Bundle Opportunities
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Min Frequency
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={localConfig.bundleMinFrequency}
                    onChange={(e) =>
                      handleChange('bundleMinFrequency', parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Min Support (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={localConfig.bundleMinSupport}
                    onChange={(e) =>
                      handleChange('bundleMinSupport', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to defaults
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
