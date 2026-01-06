import { useState } from 'react'
import { useNaturalLanguageQuery } from '../../../../hooks/useOperator'
import type { TenantHealth } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { MessageSquare, Send, Sparkles, Database } from 'lucide-react'

interface NaturalLanguageQueryProps {
  tenants: TenantHealth[]
}

export function NaturalLanguageQuery({ tenants }: NaturalLanguageQueryProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState<
    { role: 'user' | 'assistant'; content: string; dataUsed?: string | null }[]
  >([])

  const queryMutation = useNaturalLanguageQuery()

  const selectedTenant = tenants.find((t) => t.tenant_id === selectedTenantId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenantId || !query.trim()) return

    const userQuery = query.trim()
    setConversation((prev) => [...prev, { role: 'user', content: userQuery }])
    setQuery('')

    queryMutation.mutate(
      { tenant_id: selectedTenantId, query: userQuery },
      {
        onSuccess: (data) => {
          setConversation((prev) => [
            ...prev,
            { role: 'assistant', content: data.answer, dataUsed: data.data_used },
          ])
        },
        onError: () => {
          setConversation((prev) => [
            ...prev,
            { role: 'assistant', content: 'Sorry, I encountered an error processing your query.' },
          ])
        },
      }
    )
  }

  const exampleQueries = [
    'What are the top 5 selling items?',
    'What is the total revenue?',
    'Are there any active alerts?',
  ]

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-gold-500" />
          <h3 className="font-semibold text-navy-900">Ask AI</h3>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Mock Mode
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Tenant Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select Client
          </label>
          <select
            value={selectedTenantId}
            onChange={(e) => {
              setSelectedTenantId(e.target.value)
              setConversation([])
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
          >
            <option value="">Choose a client...</option>
            {tenants.map((tenant) => (
              <option key={tenant.tenant_id} value={tenant.tenant_id}>
                {tenant.tenant_name}
              </option>
            ))}
          </select>
        </div>

        {selectedTenantId && (
          <>
            {/* Example Queries */}
            {conversation.length === 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {exampleQueries.map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            <div className="min-h-48 max-h-96 overflow-y-auto mb-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="mx-auto h-10 w-10 mb-2" />
                  <p className="text-sm">Ask a question about {selectedTenant?.tenant_name}</p>
                </div>
              ) : (
                conversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-navy-900 text-white'
                          : 'bg-slate-100 text-navy-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.dataUsed && (
                        <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                          <Database size={12} />
                          <span>Data: {msg.dataUsed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {queryMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-lg px-4 py-3">
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ask about ${selectedTenant?.tenant_name}...`}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
                disabled={queryMutation.isPending}
              />
              <button
                type="submit"
                disabled={!query.trim() || queryMutation.isPending}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
