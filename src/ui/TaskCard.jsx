import { Lock, Pencil, Trash2 } from 'lucide-react'
import { formatDueDateLabel } from '../utils/time.js'

function Pill({ className, children }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function priorityLabel(priority) {
  if (priority === 'high') return { text: 'Alta', cls: 'border-red-900/50 bg-red-950/40 text-red-200' }
  if (priority === 'low') return { text: 'Baixa', cls: 'border-emerald-900/50 bg-emerald-950/30 text-emerald-200' }
  return { text: 'Média', cls: 'border-amber-900/50 bg-amber-950/30 text-amber-200' }
}

export default function TaskCard({ task, readOnly = false, onEdit, onDelete, onToggleDone }) {
  const due = formatDueDateLabel(task.dueDate)
  const priority = priorityLabel(task.effectivePriority || task.priority)
  const done = task.status === 'done'
  const canToggle = typeof onToggleDone === 'function'

  return (
    <div className="rounded-2xl border border-app bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {task.subject ? (
              <Pill className="border-app bg-surface2 text-app">
                {task.subject}
              </Pill>
            ) : null}
            <Pill className={priority.cls}>Prioridade: {priority.text}</Pill>
            <Pill
              className={
                done
                  ? 'border-app bg-surface2 text-app'
                  : 'border-app bg-surface text-muted'
              }
            >
              {done ? 'Concluída' : 'Pendente'}
            </Pill>
          </div>
          <div className="mt-2 truncate text-sm font-semibold text-app">
            {task.title}
          </div>
          {task.description ? (
            <div className="mt-1 line-clamp-2 text-sm text-muted">
              {task.description}
            </div>
          ) : null}
          {due ? <div className="mt-2 text-xs text-subtle">{due}</div> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => onToggleDone?.(e.target.checked)}
              disabled={!canToggle}
              className="h-4 w-4 rounded border border-app bg-surface text-(--primary)"
            />
            <span className="inline-flex items-center gap-1.5">
              <span>OK</span>
              {readOnly ? <Lock className="h-3.5 w-3.5 text-subtle" /> : null}
            </span>
          </label>

          {readOnly ? null : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
