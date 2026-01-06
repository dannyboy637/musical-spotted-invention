import { useState } from 'react'
import {
  useOperatorTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getPriorityColor,
} from '../../../../hooks/useOperator'
import type { OperatorTask } from '../../../../hooks/useOperator'
import { CheckSquare, Plus, Trash2, Check, X, Calendar } from 'lucide-react'
import { Spinner } from '../../../../components/ui/Spinner'
import { format, isPast, isToday } from 'date-fns'

export function TaskList() {
  const [showCompleted, setShowCompleted] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')

  const { data: tasks, isLoading } = useOperatorTasks({
    status: showCompleted ? undefined : 'pending',
  })
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return

    createTask.mutate(
      {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        due_date: newTaskDueDate || undefined,
      },
      {
        onSuccess: () => {
          setNewTaskTitle('')
          setNewTaskPriority('medium')
          setNewTaskDueDate('')
          setIsAdding(false)
        },
      }
    )
  }

  const handleToggleComplete = (task: OperatorTask) => {
    updateTask.mutate({
      id: task.id,
      updates: {
        status: task.status === 'pending' ? 'completed' : 'pending',
      },
    })
  }

  const handleDelete = (taskId: string) => {
    if (confirm('Delete this task?')) {
      deleteTask.mutate(taskId)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={18} className="text-slate-500" />
          <h3 className="font-semibold text-navy-900">Tasks</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-slate-300 text-gold-500 focus:ring-gold-500"
            />
            Show completed
          </label>
          <button
            onClick={() => setIsAdding(true)}
            className="p-1.5 text-slate-400 hover:text-navy-600 hover:bg-slate-100 rounded transition-colors"
            title="Add Task"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {isAdding && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask()
              if (e.key === 'Escape') setIsAdding(false)
            }}
          />
          <div className="flex items-center gap-2 mt-2">
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
            />
            <div className="flex-1" />
            <button
              onClick={() => setIsAdding(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim() || createTask.isPending}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {createTask.isPending ? <Spinner size="sm" /> : <Check size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            {showCompleted ? 'No tasks' : 'No pending tasks'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => handleToggleComplete(task)}
                onDelete={() => handleDelete(task.id)}
                isUpdating={updateTask.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  isUpdating,
}: {
  task: OperatorTask
  onToggle: () => void
  onDelete: () => void
  isUpdating: boolean
}) {
  const priorityColors = getPriorityColor(task.priority)
  const isOverdue =
    task.status === 'pending' &&
    task.due_date &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date))

  return (
    <div
      className={`px-4 py-3 hover:bg-slate-50 group ${
        task.status === 'completed' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            task.status === 'completed'
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 hover:border-gold-500'
          }`}
        >
          {task.status === 'completed' && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm ${
              task.status === 'completed'
                ? 'line-through text-slate-500'
                : 'text-navy-900'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${priorityColors.bg} ${priorityColors.text}`}
            >
              {task.priority}
            </span>
            {task.due_date && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
                }`}
              >
                <Calendar size={12} />
                {format(new Date(task.due_date), 'MMM d')}
                {isOverdue && ' (overdue)'}
              </span>
            )}
            {task.tenants?.name && (
              <span className="text-xs text-slate-400">
                {task.tenants.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
