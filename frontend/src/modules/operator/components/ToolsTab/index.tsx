import { useState } from 'react'
import { TenantManager } from './TenantManager'
import { ConsultantNotes } from './ConsultantNotes'
import { NaturalLanguageQuery } from './NaturalLanguageQuery'
import { useOperatorDashboard } from '../../../../hooks/useOperator'
import { Building2, StickyNote, MessageSquare } from 'lucide-react'

type ToolSection = 'tenants' | 'notes' | 'query'

export function ToolsTab() {
  const [activeSection, setActiveSection] = useState<ToolSection>('tenants')
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

  const { data: dashboard } = useOperatorDashboard()
  const tenants = dashboard?.tenants ?? []

  const sections: { id: ToolSection; label: string; icon: typeof Building2 }[] = [
    { id: 'tenants', label: 'Tenant Manager', icon: Building2 },
    { id: 'notes', label: 'Consultant Notes', icon: StickyNote },
    { id: 'query', label: 'Ask AI', icon: MessageSquare },
  ]

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2">
        {sections.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-navy-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <section.icon size={16} />
              {section.label}
            </button>
          )
        })}
      </div>

      {/* Section Content */}
      {activeSection === 'tenants' && (
        <TenantManager
          onSelectTenant={(id) => {
            setSelectedTenantId(id)
            setActiveSection('notes')
          }}
        />
      )}

      {activeSection === 'notes' && (
        <ConsultantNotes
          tenants={tenants}
          selectedTenantId={selectedTenantId}
          onSelectTenant={setSelectedTenantId}
        />
      )}

      {activeSection === 'query' && (
        <NaturalLanguageQuery tenants={tenants} />
      )}
    </div>
  )
}
