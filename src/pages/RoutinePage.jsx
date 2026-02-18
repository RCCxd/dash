import { useMemo, useState } from 'react'
import { Lock, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useUserData } from '../state/user/userDataContext.js'
import { newId } from '../utils/ids.js'
import { formatWeekdayShort } from '../utils/week.js'

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 22
const ROW_H_PX = 44

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map((x) => Number(x))
  return (h || 0) * 60 + (m || 0)
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value))
}

function RoutineGrid({ events }) {
  const range = useMemo(() => {
    let startMin = DEFAULT_START_HOUR * 60
    let endMin = DEFAULT_END_HOUR * 60

    for (const e of events || []) {
      const start = toMinutes(e?.start)
      const end = toMinutes(e?.end)
      if (Number.isFinite(start)) startMin = Math.min(startMin, Math.floor(start / 60) * 60)
      if (Number.isFinite(end)) endMin = Math.max(endMin, Math.ceil(end / 60) * 60)
    }

    startMin = clamp(0, startMin, 24 * 60)
    endMin = clamp(0, Math.max(startMin + 60, endMin), 24 * 60)

    const hours = []
    for (let m = startMin; m < endMin; m += 60) hours.push(Math.floor(m / 60))

    return { startMin, endMin, hours }
  }, [events])

  const byDay = useMemo(() => {
    const map = new Map()
    for (const d of DAYS) map.set(d, [])
    for (const e of events) {
      const list = map.get(e.day) || []
      list.push(e)
      map.set(e.day, list)
    }
    for (const d of DAYS) {
      const list = map.get(d) || []
      list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
      map.set(d, list)
    }
    return map
  }, [events])

  return (
    <div className="dash-card overflow-hidden rounded-2xl border border-app bg-surface">
      <div className="grid grid-cols-[56px_repeat(7,minmax(110px,1fr))] border-b border-app md:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="p-2 text-xs text-muted">Hora</div>
        {DAYS.map((d) => (
          <div key={d} className="border-l border-app p-2 text-[11px] text-app md:text-xs">
            {formatWeekdayShort(d)}
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="grid grid-cols-[56px_repeat(7,minmax(110px,1fr))] md:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-app">
            {range.hours.map((h) => (
              <div key={h} className="h-11 border-b border-app p-2 text-xs text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {DAYS.map((d) => (
            <div key={d} className="relative border-l border-app">
              {range.hours.map((h) => (
                <div key={h} className="h-11 border-b border-app" />
              ))}

              {(byDay.get(d) || []).map((e) => {
                const start = toMinutes(e.start)
                const end = toMinutes(e.end)
                const clampedStart = clamp(range.startMin, start, range.endMin)
                const clampedEnd = clamp(range.startMin, Math.max(end, start + 15), range.endMin)
                const top = ((clampedStart - range.startMin) / 60) * ROW_H_PX
                const height = Math.max(18, ((clampedEnd - clampedStart) / 60) * ROW_H_PX)
                return (
                  <div
                    key={e.id}
                    className="absolute left-1 right-1 overflow-hidden rounded-xl border border-app bg-surface2 px-2 py-1 text-xs text-app"
                    style={{ top, height }}
                    title={`${e.title} (${e.start}-${e.end})`}
                  >
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="truncate text-[11px] text-muted">
                      {e.start}-{e.end}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RoutinePage() {
  const {
    userRoutine,
    addUserRoutineEvents,
    deleteUserRoutineEvent,
    replaceUserRoutine,
    updateUserRoutineEvent,
  } = useUserData()

  const myEventsSorted = useMemo(() => {
    const list = [...userRoutine]
    list.sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start))
    return list
  }, [userRoutine])

  const localEventsCount = useMemo(
    () => myEventsSorted.filter((event) => event.source !== 'shared').length,
    [myEventsSorted],
  )

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    day: 0,
    start: '19:00',
    end: '20:00',
    title: '',
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function openNew() {
    setEditing(null)
    setForm({ day: 0, start: '19:00', end: '20:00', title: '' })
    setEditorOpen(true)
  }

  function openEdit(event) {
    if (!event) return
    setEditing(event)
    setForm({
      day: Number(event.day) || 0,
      start: event.start || '19:00',
      end: event.end || '20:00',
      title: event.title || '',
    })
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditing(null)
  }

  function onSave(e) {
    e.preventDefault()
    const title = String(form.title || '').trim()
    if (!title) return

    const patch = {
      day: Number(form.day) || 0,
      start: String(form.start || '19:00'),
      end: String(form.end || '20:00'),
      title,
    }

    if (editing?.id) updateUserRoutineEvent(editing.id, patch)
    else addUserRoutineEvents([{ id: newId(), ...patch, createdAt: Date.now() }])

    closeEditor()
  }

  function clearAll() {
    if (localEventsCount === 0) return
    if (!window.confirm('Limpar todas as atividades locais?')) return
    replaceUserRoutine([])
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:pb-6 lg:max-w-none">
      <div className="dash-enter flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Rotina</h1>
          <p className="mt-1 text-sm text-muted">
            A grade da turma vem preenchida para todos. Atividades extras ficam salvas neste dispositivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNew}
            className="dash-tab inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium btn-primary"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={localEventsCount === 0}
            className={[
              'dash-tab inline-flex items-center gap-2 rounded-xl border border-app px-3 py-2 text-sm',
              localEventsCount === 0
                ? 'cursor-not-allowed bg-surface2 text-muted'
                : 'bg-surface text-app hover:bg-surface2',
            ].join(' ')}
          >
            <RotateCcw className="h-4 w-4" />
            Limpar
          </button>
        </div>
      </div>

      <div className="dash-enter mt-4" style={{ animationDelay: '40ms' }}>
        <div className="mb-2 text-xs font-medium text-muted">Grade semanal</div>
        <div className="overflow-x-auto rounded-2xl md:overflow-x-visible">
          <div className="min-w-[960px] md:min-w-0">
            <RoutineGrid events={myEventsSorted} />
          </div>
        </div>
      </div>

      <div className="dash-card dash-enter mt-6 rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-app">Minhas atividades</div>
            <p className="mt-1 text-xs text-muted">Aulas da turma ficam fixas. Somente atividades pessoais podem ser editadas.</p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="dash-tab inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {myEventsSorted.length === 0 ? (
            <div className="dash-enter rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
              Nenhuma atividade salva ainda.
            </div>
          ) : (
            myEventsSorted.map((e, index) => {
              const readOnly = e.source === 'shared'
              return (
                <div
                  key={e.id}
                  className="dash-card dash-enter flex items-center justify-between gap-3 rounded-2xl border border-app bg-surface px-3 py-2"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-app">{e.title}</div>
                    <div className="truncate text-xs text-muted">
                      {formatWeekdayShort(e.day)} {e.start}-{e.end}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {readOnly ? (
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface2 text-muted"
                        title="Aula fixa da turma"
                      >
                        <Lock className="h-4 w-4" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUserRoutineEvent(e.id)}
                          className="dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {editorOpen ? (
        <div className="dash-overlay-in fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="dash-modal-in w-full max-w-lg overflow-hidden rounded-2xl border border-app bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <div className="text-sm font-semibold text-app">
                {editing ? 'Editar atividade' : 'Adicionar atividade'}
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSave} className="space-y-3 p-4">
              <label className="block">
                <div className="text-xs font-medium text-muted">Titulo *</div>
                <input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Ex: Estudar Matematica"
                  className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="block">
                  <div className="text-xs font-medium text-muted">Dia</div>
                  <select
                    value={String(form.day)}
                    onChange={(e) => set('day', Number(e.target.value))}
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {formatWeekdayShort(d)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-muted">Inicio</div>
                  <input
                    type="time"
                    value={form.start}
                    onChange={(e) => set('start', e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                  />
                </label>

                <label className="block">
                  <div className="text-xs font-medium text-muted">Fim</div>
                  <input
                    type="time"
                    value={form.end}
                    onChange={(e) => set('end', e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                  />
                </label>
              </div>

              <button type="submit" className="dash-tab h-10 w-full rounded-xl text-sm font-medium btn-primary">
                Salvar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

