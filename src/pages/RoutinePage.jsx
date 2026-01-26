import { useMemo, useRef, useState } from 'react'
import { Bot, CornerDownLeft, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useTasks } from '../state/tasks/tasksContext.js'
import { useGlobalData } from '../state/global/globalDataContext.js'
import { useUserData } from '../state/user/userDataContext.js'
import { useSettings } from '../state/settings/settingsContext.js'
import { newId } from '../utils/ids.js'
import { formatWeekdayShort } from '../utils/week.js'

function ChatBubble({ role, children }) {
  const isUser = role === 'user'
  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-relaxed',
          isUser ? 'border-app bg-surface2 text-app' : 'border-app bg-surface text-app',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 06..22

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map((x) => Number(x))
  return (h || 0) * 60 + (m || 0)
}

function minutesToTop(min) {
  const start = 6 * 60
  const end = 22 * 60
  const clamped = Math.max(start, Math.min(end, min))
  return ((clamped - start) / (end - start)) * 100
}

function mergeEvents(globalEvents, userEvents) {
  const g = Array.isArray(globalEvents) ? globalEvents : []
  const u = Array.isArray(userEvents) ? userEvents : []
  return [
    ...g.map((e) => ({ ...e, source: 'global' })),
    ...u.map((e) => ({ ...e, source: 'user' })),
  ]
}

function RoutineGrid({ events }) {
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
    <div className="overflow-hidden rounded-2xl border border-app bg-surface">
      <div className="grid grid-cols-[56px_repeat(7,minmax(120px,1fr))] border-b border-app">
        <div className="p-2 text-xs text-muted">Hora</div>
        {DAYS.map((d) => (
          <div key={d} className="border-l border-app p-2 text-xs text-app">
            {formatWeekdayShort(d)}
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="grid grid-cols-[56px_repeat(7,minmax(120px,1fr))]">
          <div className="border-r border-app">
            {HOURS.map((h) => (
              <div key={h} className="h-10 border-b border-app p-2 text-xs text-muted">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {DAYS.map((d) => (
            <div key={d} className="relative border-l border-app">
              {HOURS.map((h) => (
                <div key={h} className="h-10 border-b border-app" />
              ))}

              {(byDay.get(d) || []).map((e) => {
                const start = toMinutes(e.start)
                const end = toMinutes(e.end)
                const top = minutesToTop(start)
                const bottom = minutesToTop(end)
                const height = Math.max(2, bottom - top)
                const isUser = e.source === 'user'
                return (
                  <div
                    key={`${e.source}-${e.id}`}
                    className={[
                      'absolute left-2 right-2 rounded-xl border px-2 py-1 text-xs',
                      'overflow-hidden',
                      isUser ? 'border-app bg-surface2 text-app' : 'border-app bg-surface text-muted',
                    ].join(' ')}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title={`${e.title} (${e.start}-${e.end})`}
                  >
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="truncate text-[11px] text-muted">
                      {e.start}–{e.end}
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

async function requestRoutineAI({ messages, tasks, openAiKey, openAiModel }) {
  const resp = await fetch('/api/routine-ai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(openAiKey ? { 'x-openai-key': openAiKey } : null),
      ...(openAiModel ? { 'x-openai-model': openAiModel } : null),
    },
    body: JSON.stringify({ messages, tasks }),
  })
  const data = await resp.json()
  if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha ao gerar rotina.')
  return data
}

export default function RoutinePage() {
  const { tasks } = useTasks()
  const { settings } = useSettings()
  const {
    routine: globalRoutine,
    loading: globalLoading,
    error: globalError,
    reload,
  } = useGlobalData()
  const { userRoutine, replaceUserRoutine, addUserRoutineEvents, deleteUserRoutineEvent } =
    useUserData()

  const allEvents = useMemo(
    () => mergeEvents(globalRoutine?.events || [], userRoutine),
    [globalRoutine, userRoutine],
  )

  const [messages, setMessages] = useState([
    {
      id: 'seed',
      role: 'assistant',
      content:
        'Me diga sua disponibilidade (dias/horários), matérias e prazos. Eu monto uma rotina semanal e, ao salvar, preencho sua grade.',
    },
  ])
  const [input, setInput] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy])

  function scrollToBottom() {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  async function onSend() {
    if (!canSend) return
    const text = input.trim()
    const nextUserMessage = { id: newId(), role: 'user', content: text }
    setInput('')
    setBusy(true)
    setSuggestion(null)

    setMessages((prev) => [...prev, nextUserMessage])
    if (settings.autoScrollChat) queueMicrotask(scrollToBottom)

    try {
      const history = [...messages, nextUserMessage]
        .filter((m) => m && m.id !== 'seed' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }))
      const data = await requestRoutineAI({
        messages: history,
        tasks,
        openAiKey: settings.openAiKey || '',
        openAiModel: settings.openAiModel || '',
      })
      setSuggestion(data)
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', content: data.reply || 'Pronto.' },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: `Erro ao gerar rotina: ${e?.message || String(e)}`,
        },
      ])
    } finally {
      if (settings.autoScrollChat) queueMicrotask(scrollToBottom)
      setBusy(false)
    }
  }

  function saveSuggestionToGrid() {
    if (!suggestion?.events?.length) return
    const mapped = suggestion.events.map((e) => ({
      id: newId(),
      day: e.day,
      start: e.start,
      end: e.end,
      title: e.title,
      createdAt: Date.now(),
    }))
    if (settings.routineSaveMode === 'append') addUserRoutineEvents(mapped)
    else replaceUserRoutine(mapped)
  }

  const myEventsSorted = useMemo(() => {
    const list = [...userRoutine]
    list.sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start))
    return list
  }, [userRoutine])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Rotina</h1>
          <p className="mt-1 text-sm text-muted">
            Grade semanal + planejamento por IA (salvar preenche automaticamente).
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {globalLoading ? (
        <div className="mt-4 rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
          Carregando dados globais…
        </div>
      ) : globalError ? (
        <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200">
          {globalError}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted">Grade semanal</div>
        <div className="overflow-auto rounded-2xl">
          <div className="min-w-[960px]">
            <RoutineGrid events={allEvents} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-app bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-app">Meu planejamento (IA)</div>
            {suggestion?.events?.length ? (
              <button
                type="button"
                onClick={saveSuggestionToGrid}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium btn-primary"
              >
                <Save className="h-4 w-4" />
                Salvar na grade
              </button>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="mt-3 h-[320px] space-y-3 overflow-auto rounded-2xl border border-app bg-surface p-3"
          >
            {messages.map((m) => (
              <ChatBubble key={m.id} role={m.role}>
                {m.content}
              </ChatBubble>
            ))}

            {suggestion?.events?.length ? (
              <div className="mt-2 rounded-2xl border border-app bg-surface p-4">
                <div className="flex items-start gap-2 text-sm font-semibold text-app">
                  <Bot className="h-4 w-4 text-muted" />
                  {suggestion.title || 'Rotina sugerida'}
                </div>
                <div className="mt-2 space-y-1 text-sm text-app">
                  {suggestion.events.slice(0, 10).map((e) => (
                    <div key={`${e.day}-${e.start}-${e.end}-${e.title}`}>
                      {formatWeekdayShort(e.day)} {e.start}–{e.end}: {e.title}
                    </div>
                  ))}
                  {suggestion.events.length > 10 ? (
                    <div className="text-xs text-muted">
                      +{suggestion.events.length - 10} itens…
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="Ex: Seg a Sex 19:00-21:00. Prova de Matemática terça. Redação sexta. Quero 30min de revisão diária."
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-app bg-surface px-4 py-3 text-sm text-app placeholder:text-muted focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className={[
                'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium',
                canSend ? 'btn-primary' : 'cursor-not-allowed bg-surface2 text-muted',
              ].join(' ')}
            >
              <CornerDownLeft className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-app bg-surface p-4">
          <div className="text-sm font-semibold text-app">Minhas atividades (editáveis)</div>
          <p className="mt-1 text-xs text-muted">
            Você pode deletar apenas o que você adicionou (dados locais).
          </p>

          <div className="mt-3 space-y-2">
            {myEventsSorted.length === 0 ? (
              <div className="rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
                Nenhuma atividade salva ainda.
              </div>
            ) : (
              myEventsSorted.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-app bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-app">{e.title}</div>
                    <div className="truncate text-xs text-muted">
                      {formatWeekdayShort(e.day)} {e.start}–{e.end}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteUserRoutineEvent(e.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
