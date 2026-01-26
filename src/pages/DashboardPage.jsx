import { useMemo, useState } from 'react'
import { SearchX } from 'lucide-react'
import { useTasks } from '../state/tasks/tasksContext.js'
import { useSettings } from '../state/settings/settingsContext.js'
import TaskCard from '../ui/TaskCard.jsx'

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'done', label: 'Concluídas' },
]

export default function DashboardPage() {
  const { tasks, setTaskStatus } = useTasks()
  const { settings } = useSettings()
  const [filter, setFilter] = useState(() => settings.defaultTaskFilter || 'pending')

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    if (filter === 'pending') return tasks.filter((t) => t.status !== 'done')
    return tasks.filter((t) => t.status === 'done')
  }, [tasks, filter])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">
            Dashboard & Tarefas
          </h1>
          <p className="mt-1 text-sm text-muted">Acompanhe suas entregas sem planilha.</p>
        </div>
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
              Aguarde o administrador adicionar tarefas globais.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              readOnly
              onToggleDone={(done) => setTaskStatus(task.id, done ? 'done' : 'pending')}
            />
          ))
        )}
      </div>
    </div>
  )
}

