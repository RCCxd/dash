import { useMemo, useState } from 'react'
import { Plus, SearchX, X } from 'lucide-react'
import { useTasks } from '../state/tasks/tasksContext.js'
import { useSettings } from '../state/settings/settingsContext.js'
import TaskCard from '../ui/TaskCard.jsx'

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'done', label: 'Concluídas' },
]

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

export default function DashboardPage() {
  const { tasks, setTaskStatus, addUserTask, updateUserTask, deleteUserTask } = useTasks()
  const { settings } = useSettings()
  const [filter, setFilter] = useState(() => settings.defaultTaskFilter || 'pending')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    subject: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
  })

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    if (filter === 'pending') return tasks.filter((t) => t.status !== 'done')
    return tasks.filter((t) => t.status === 'done')
  }, [tasks, filter])

  function openNew() {
    setEditing(null)
    setForm({ subject: '', title: '', description: '', dueDate: '', priority: 'medium' })
    setEditorOpen(true)
  }

  function openEdit(task) {
    if (!task || task.source !== 'user') return
    setEditing(task)
    setForm({
      subject: task.subject || '',
      title: task.title || '',
      description: task.description || '',
      dueDate: task.dueDate || '',
      priority: task.priority || 'medium',
    })
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
  }

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function onSave(e) {
    e.preventDefault()
    const title = String(form.title || '').trim()
    if (!title) return

    const payload = {
      subject: String(form.subject || '').trim(),
      title,
      description: String(form.description || '').trim(),
      dueDate: form.dueDate || '',
      priority: form.priority || 'medium',
    }

    if (editing?.id) updateUserTask(editing.id, payload)
    else addUserTask(payload)

    closeEditor()
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">
            Dashboard & Tarefas
          </h1>
          <p className="mt-1 text-sm text-muted">Acompanhe suas entregas sem planilha.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm',
                'transition-colors',
                active
                  ? 'border-app bg-surface2 text-app'
                  : 'border-app bg-surface text-muted hover:bg-surface2',
              ].join(' ')}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-app bg-surface p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface2">
              <SearchX className="h-5 w-5 text-muted" />
            </div>
            <p className="mt-3 text-sm text-app">Nada por aqui.</p>
            <p className="mt-1 text-xs text-muted">
              Clique em "Nova tarefa" para criar uma tarefa pessoal (editável).
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              readOnly={task.source !== 'user'}
              onEdit={task.source === 'user' ? () => openEdit(task) : undefined}
              onDelete={task.source === 'user' ? () => deleteUserTask(task.id) : undefined}
              onToggleDone={(done) => setTaskStatus(task.id, done ? 'done' : 'pending')}
            />
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-app bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <div className="text-sm font-semibold text-app">
                {editing ? 'Editar tarefa' : 'Nova tarefa'}
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSave} className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-medium text-muted">Matéria</div>
                  <input
                    value={form.subject}
                    onChange={(e) => set('subject', e.target.value)}
                    placeholder="Ex: Matemática"
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-muted">Data de entrega</div>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => set('dueDate', e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs font-medium text-muted">Título *</div>
                <input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Ex: Lista de exercícios 3"
                  className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-muted">Descrição</div>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  placeholder="Detalhes, links, páginas..."
                  className="mt-1 w-full resize-none rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app placeholder:text-muted focus:outline-none"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-muted">Prioridade</div>
                <select
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="h-10 w-full rounded-xl text-sm font-medium btn-primary">
                Salvar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
