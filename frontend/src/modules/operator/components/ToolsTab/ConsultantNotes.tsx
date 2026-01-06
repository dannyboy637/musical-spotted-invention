import { useState } from 'react'
import {
  useConsultantNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from '../../../../hooks/useOperator'
import type { TenantHealth, ConsultantNote } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import {
  StickyNote,
  Plus,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

interface ConsultantNotesProps {
  tenants: TenantHealth[]
  selectedTenantId: string | null
  onSelectTenant: (id: string | null) => void
}

export function ConsultantNotes({
  tenants,
  selectedTenantId,
  onSelectTenant,
}: ConsultantNotesProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: notes, isLoading } = useConsultantNotes(selectedTenantId ?? '')
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const selectedTenant = tenants.find((t) => t.tenant_id === selectedTenantId)

  const handleAddNote = () => {
    if (!selectedTenantId || !newNoteContent.trim()) return
    createNote.mutate(
      { tenantId: selectedTenantId, note: { content: newNoteContent.trim() } },
      {
        onSuccess: () => {
          setNewNoteContent('')
          setIsAdding(false)
        },
      }
    )
  }

  const handleUpdateNote = (noteId: string) => {
    if (!selectedTenantId || !editContent.trim()) return
    updateNote.mutate(
      { id: noteId, tenantId: selectedTenantId, updates: { content: editContent.trim() } },
      {
        onSuccess: () => {
          setEditingNoteId(null)
          setEditContent('')
        },
      }
    )
  }

  const handleTogglePin = (note: ConsultantNote) => {
    if (!selectedTenantId) return
    updateNote.mutate({
      id: note.id,
      tenantId: selectedTenantId,
      updates: { is_pinned: !note.is_pinned },
    })
  }

  const handleDeleteNote = (noteId: string) => {
    if (!selectedTenantId || !confirm('Delete this note?')) return
    deleteNote.mutate({ id: noteId, tenantId: selectedTenantId })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Tenant Selector */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-navy-900 text-sm">Select Client</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {tenants.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-sm">No clients</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.tenant_id}
                    onClick={() => onSelectTenant(tenant.tenant_id)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                      selectedTenantId === tenant.tenant_id ? 'bg-gold-50 border-l-2 border-gold-500' : ''
                    }`}
                  >
                    <span className="font-medium text-navy-900 text-sm">{tenant.tenant_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Panel */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-slate-500" />
              <h3 className="font-semibold text-navy-900">
                {selectedTenant ? `Notes for ${selectedTenant.tenant_name}` : 'Select a client'}
              </h3>
            </div>
            {selectedTenantId && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-navy-900 text-white text-sm rounded-md hover:bg-navy-800 transition-colors"
              >
                <Plus size={16} />
                Add Note
              </button>
            )}
          </div>

          {!selectedTenantId ? (
            <div className="py-12 text-center text-slate-500">
              <StickyNote className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p>Select a client to view and add notes</p>
            </div>
          ) : (
            <>
              {/* Add Note Form */}
              {isAdding && (
                <div className="px-4 py-4 border-b border-slate-100 bg-slate-50">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write your note..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500 resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setNewNoteContent('')
                      }}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={!newNoteContent.trim() || createNote.isPending}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {createNote.isPending ? <Spinner size="sm" /> : <Check size={16} />}
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Notes List */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                ) : !notes || notes.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    No notes yet. Add your first note above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notes.map((note) => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        isEditing={editingNoteId === note.id}
                        editContent={editContent}
                        onStartEdit={() => {
                          setEditingNoteId(note.id)
                          setEditContent(note.content)
                        }}
                        onCancelEdit={() => {
                          setEditingNoteId(null)
                          setEditContent('')
                        }}
                        onSaveEdit={() => handleUpdateNote(note.id)}
                        onEditContentChange={setEditContent}
                        onTogglePin={() => handleTogglePin(note)}
                        onDelete={() => handleDeleteNote(note.id)}
                        isUpdating={updateNote.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteItem({
  note,
  isEditing,
  editContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  onTogglePin,
  onDelete,
  isUpdating,
}: {
  note: ConsultantNote
  isEditing: boolean
  editContent: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditContentChange: (content: string) => void
  onTogglePin: () => void
  onDelete: () => void
  isUpdating: boolean
}) {
  return (
    <div className={`px-4 py-3 ${note.is_pinned ? 'bg-gold-50' : ''}`}>
      {isEditing ? (
        <div>
          <textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onCancelEdit} className="p-1.5 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
            <button
              onClick={onSaveEdit}
              disabled={isUpdating}
              className="p-1.5 text-emerald-600 hover:text-emerald-700"
            >
              {isUpdating ? <Spinner size="sm" /> : <Check size={16} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="group">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {note.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-gold-700 mb-1">
                  <Pin size={12} /> Pinned
                </span>
              )}
              <p className="text-sm text-navy-900 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                {note.updated_at !== note.created_at && ' (edited)'}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onTogglePin}
                className={`p-1.5 rounded transition-colors ${
                  note.is_pinned
                    ? 'text-gold-600 hover:text-gold-700'
                    : 'text-slate-400 hover:text-navy-600'
                }`}
                title={note.is_pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={14} />
              </button>
              <button
                onClick={onStartEdit}
                className="p-1.5 text-slate-400 hover:text-navy-600 rounded transition-colors"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
