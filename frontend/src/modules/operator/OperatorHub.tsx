import { useState } from 'react'
import { Users, Activity, Wrench } from 'lucide-react'
import { ClientsTab } from './components/ClientsTab'
import { TechnicalTab } from './components/TechnicalTab'
import { ToolsTab } from './components/ToolsTab'

type TabId = 'clients' | 'technical' | 'tools'

const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'technical', label: 'Technical', icon: Activity },
  { id: 'tools', label: 'Tools', icon: Wrench },
]

export function OperatorHub() {
  const [activeTab, setActiveTab] = useState<TabId>('clients')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Operator Control Hub</h1>
          <p className="text-slate-600 mt-1">Monitor all clients and system health</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-gold-500 text-navy-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'clients' && <ClientsTab />}
        {activeTab === 'technical' && <TechnicalTab />}
        {activeTab === 'tools' && <ToolsTab />}
      </div>
    </div>
  )
}
