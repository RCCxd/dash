import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, SearchX, X } from 'lucide-react'
import { useTasks } from '../state/tasks/tasksContext.js'
import { useSettings } from '../state/settings/settingsContext.js'
import TaskCard from '../ui/TaskCard.jsx'

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'done', label: 'Concluídas' },
]

const VIEWS = [
  { key: 'subjects', label: 'Matérias' },
  { key: 'upcoming', label: 'Próximas' },
]

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

function subjectKey(subject) {
  const s = String(subject || '').trim()
  return s ? s : '__none__'
}

function subjectLabel(key) {
  return key === '__none__' ? 'Sem matéria' : key
}

function isValidIsoDate(dueDate) {
  return Boolean(dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(dueDate)))
}

export default function DashboardPage() {
  const { tasks, setTaskStatus, addUserTask, updateUserTask, deleteUserTask } = useTasks()
  const { settings } = useSettings()

  const [view, setView] = useState('subjects')
  const [activeSubject, setActiveSubject] = useState(null)
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

  const subjects = useMemo(() => {
    const map = new Map()
    for (const t of tasks) {
      const key = subjectKey(t.subject)
      const prev = map.get(key) || {
        key,
        label: subjectLabel(key),
        tasks: [],
        pending: 0,
        done: 0,
        nextDue: '9999-12-31',
      }

      prev.tasks.push(t)
      if (t.status === 'done') prev.done += 1
      else prev.pending += 1

      if (t.status !== 'done' && isValidIsoDate(t.dueDate) && t.dueDate < prev.nextDue) {
        prev.nextDue = t.dueDate
      }

      map.set(key, prev)
    }

    return [...map.values()].sort((a, b) => {
      if (a.nextDue < b.nextDue) return -1
      if (a.nextDue > b.nextDue) return 1
      if (b.pending !== a.pending) return b.pending - a.pending
      return String(a.label).localeCompare(String(b.label))
    })
  }, [tasks])

  const activeSubjectInfo = useMemo(() => {
    if (!activeSubject) return null
    return subjects.find((s) => s.key === activeSubject) || null
  }, [activeSubject, subjects])

  const visibleTasks = useMemo(() => {
    const base = activeSubjectInfo?.tasks || []
    if (filter === 'all') return base
    if (filter === 'pending') return base.filter((t) => t.status !== 'done')
    return base.filter((t) => t.status === 'done')
  }, [activeSubjectInfo, filter])

  const upcomingTasks = useMemo(() => {
    const pendingWithDue = tasks
      .filter((t) => t.status !== 'done' && isValidIsoDate(t.dueDate))
      .sort((a, b) => {
        if (a.dueDate < b.dueDate) return -1
        if (a.dueDate > b.dueDate) return 1
        return String(a.title || '').localeCompare(String(b.title || ''))
      })

    const pendingNoDue = tasks
      .filter((t) => t.status !== 'done' && !isValidIsoDate(t.dueDate))
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))

    return { withDue: pendingWithDue, noDue: pendingNoDue }
  }, [tasks])

  function openNew(presetSubject) {
    setEditing(null)
    setForm({
      subject: String(presetSubject || '').trim(),
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
    })
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

  function goSubjectsRoot() {
    setActiveSubject(null)
    setView('subjects')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Tarefas</h1>
          <p className="mt-1 text-sm text-muted">Organize por matéria e acompanhe prazos.</p>
        </div>
        <button
          type="button"
          onClick={() => openNew(activeSubjectInfo?.key && activeSubjectInfo.key !== '__none__' ? activeSubjectInfo.label : '')}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {VIEWS.map((v) => {
          const active = v.key === view
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setView(v.key)
                if (v.key !== 'subjects') setActiveSubject(null)
              }}
              className={[
                'rounded-full border px-3 py-1.5 text-sm',
                'transition-colors',
                active ? 'border-app bg-surface2 text-app' : 'border-app bg-surface text-muted hover:bg-surface2',
              ].join(' ')}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      {view === 'subjects' ? (
        <div className="mt-4 space-y-4">
          {activeSubjectInfo ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goSubjectsRoot}
                  className="inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Matérias
                </button>

                <div className="min-w-0 text-sm font-semibold text-app">{activeSubjectInfo.label}</div>
              </div>

              <div className="flex gap-2">
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

              <div className="space-y-3">
                {visibleTasks.length === 0 ? (
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
                  visibleTasks.map((task) => (
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
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {subjects.length === 0 ? (
                <div className="rounded-2xl border border-app bg-surface p-5 text-center md:col-span-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface2">
                    <SearchX className="h-5 w-5 text-muted" />
                  </div>
                  <p className="mt-3 text-sm text-app">Nenhuma tarefa ainda.</p>
                  <p className="mt-1 text-xs text-muted">Clique em "Nova tarefa" para começar.</p>
                </div>
              ) : (
                subjects.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveSubject(s.key)}
                    className="rounded-2xl border border-app bg-surface p-4 text-left transition-colors hover:bg-surface2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-app">{s.label}</div>
                        <div className="mt-1 text-xs text-muted">
                          {s.pending} pendente{s.pending === 1 ? '' : 's'} • {s.done} concluída
                          {s.done === 1 ? '' : 's'}
                        </div>
                      </div>
                      {s.nextDue !== '9999-12-31' ? (
                        <div className="shrink-0 rounded-full border border-app bg-surface px-2 py-0.5 text-xs text-muted">
                          Próxima: {s.nextDue.split('-').reverse().join('/')}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-app bg-surface p-4">
            <div className="text-sm font-semibold text-app">Mais perto da entrega</div>
            <p className="mt-1 text-xs text-muted">Pendentes com data ordenadas por prazo.</p>
          </div>

          <div className="space-y-3">
            {upcomingTasks.withDue.length === 0 ? (
              <div className="rounded-2xl border border-app bg-surface p-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface2">
                  <SearchX className="h-5 w-5 text-muted" />
                </div>
                <p className="mt-3 text-sm text-app">Sem prazos por enquanto.</p>
                <p className="mt-1 text-xs text-muted">Adicione datas de entrega nas tarefas para aparecer aqui.</p>
              </div>
            ) : (
              upcomingTasks.withDue.slice(0, 30).map((task) => (
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

          {upcomingTasks.noDue.length ? (
            <div className="rounded-2xl border border-app bg-surface p-4">
              <div className="text-sm font-semibold text-app">Sem data</div>
              <p className="mt-1 text-xs text-muted">Também pendentes, mas sem prazo definido.</p>
              <div className="mt-3 space-y-3">
                {upcomingTasks.noDue.slice(0, 10).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    readOnly={task.source !== 'user'}
                    onEdit={task.source === 'user' ? () => openEdit(task) : undefined}
                    onDelete={task.source === 'user' ? () => deleteUserTask(task.id) : undefined}
                    onToggleDone={(done) => setTaskStatus(task.id, done ? 'done' : 'pending')}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-app bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <div className="text-sm font-semibold text-app">{editing ? 'Editar tarefa' : 'Nova tarefa'}</div>
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
