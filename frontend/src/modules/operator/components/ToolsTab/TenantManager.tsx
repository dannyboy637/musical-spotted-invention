import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../../../../stores/authStore'
import { useUpdateTenantStatus } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import {
  Plus,
  Edit2,
  Power,
  PowerOff,
  StickyNote,
  Users,
  Check,
  X,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Tenant {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  is_active?: boolean
}

interface TenantManagerProps {
  onSelectTenant: (id: string) => void
}

export function TenantManager({ onSelectTenant }: TenantManagerProps) {
  const { session } = useAuthStore()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await axios.get<Tenant[]>(`${API_URL}/tenants`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      return response.data
    },
    enabled: !!session?.access_token,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const response = await axios.post(`${API_URL}/tenants`, data, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
      setIsCreating(false)
      setFormData({ name: '', slug: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; slug?: string } }) => {
      const response = await axios.put(`${API_URL}/tenants/${id}`, data, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['operator', 'dashboard'] })
      setEditingId(null)
      setFormData({ name: '', slug: '' })
    },
  })

  const statusMutation = useUpdateTenantStatus()

  const handleCreate = () => {
    if (!formData.name || !formData.slug) return
    createMutation.mutate(formData)
  }

  const handleUpdate = (id: string) => {
    if (!formData.name || !formData.slug) return
    updateMutation.mutate({ id, data: formData })
  }

  const handleToggleStatus = (tenant: Tenant) => {
    const newStatus = !(tenant.is_active ?? true)
    if (!newStatus && !confirm(`Disable ${tenant.name}? They won't be able to access the dashboard.`)) {
      return
    }
    statusMutation.mutate({ tenantId: tenant.id, isActive: newStatus })
  }

  const startEditing = (tenant: Tenant) => {
    setEditingId(tenant.id)
    setFormData({ name: tenant.name, slug: tenant.slug })
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-navy-900">Tenant Manager</h3>
        <button
          onClick={() => {
            setIsCreating(true)
            setFormData({ name: '', slug: '' })
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-navy-900 text-white text-sm rounded-md hover:bg-navy-800 transition-colors"
        >
          <Plus size={16} />
          Add Tenant
        </button>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="px-4 py-4 border-b border-slate-100 bg-slate-50">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  })
                }}
                placeholder="Restaurant Name"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="restaurant-name"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name || !formData.slug || createMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? <Spinner size="sm" /> : <Check size={16} />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tenant List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !tenants || tenants.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p>No tenants yet. Create your first client above.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className={`px-4 py-3 hover:bg-slate-50 ${
                !(tenant.is_active ?? true) ? 'opacity-60' : ''
              }`}
            >
              {editingId === tenant.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500"
                    />
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => handleUpdate(tenant.id)}
                      disabled={updateMutation.isPending}
                      className="p-1.5 text-emerald-600 hover:text-emerald-700"
                    >
                      {updateMutation.isPending ? <Spinner size="sm" /> : <Check size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900">{tenant.name}</span>
                      {!(tenant.is_active ?? true) && (
                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-slate-500 font-mono">{tenant.slug}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSelectTenant(tenant.id)}
                      className="p-2 text-slate-400 hover:text-navy-600 hover:bg-slate-100 rounded transition-colors"
                      title="View Notes"
                    >
                      <StickyNote size={16} />
                    </button>
                    <button
                      onClick={() => startEditing(tenant)}
                      className="p-2 text-slate-400 hover:text-navy-600 hover:bg-slate-100 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(tenant)}
                      disabled={statusMutation.isPending}
                      className={`p-2 rounded transition-colors ${
                        tenant.is_active ?? true
                          ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title={tenant.is_active ?? true ? 'Disable' : 'Enable'}
                    >
                      {tenant.is_active ?? true ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
