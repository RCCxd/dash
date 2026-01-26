import { useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useGlobalData } from '../state/global/globalDataContext.js'
import { newId } from '../utils/ids.js'
import { downloadJson } from '../utils/download.js'

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

function normalizeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return { tasks: [] }
  const tasks = Array.isArray(envelope.tasks) ? envelope.tasks : []
  return { ...envelope, tasks }
}

function sortGlobalTasks(list) {
  return [...list].sort((a, b) => {
    const ad = a?.dueDate || '9999-12-31'
    const bd = b?.dueDate || '9999-12-31'
    if (ad < bd) return -1
    if (ad > bd) return 1
    return String(a?.title || '').localeCompare(String(b?.title || ''))
  })
}

export default function AdminPage() {
  const {
    tasks: globalTasks,
    updateGlobalTasks,
    isAdmin,
    adminBusy,
    adminAuthError,
    signInAdmin,
    signOutAdmin,
    adminConfigured,
  } = useGlobalData()
  const envelope = useMemo(() => normalizeEnvelope(globalTasks), [globalTasks])
  const tasksSorted = useMemo(() => sortGlobalTasks(envelope.tasks), [envelope.tasks])

  const [adminDraft, setAdminDraft] = useState('')
  const [form, setForm] = useState({
    subject: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function saveEnvelope(nextEnvelope, { autoExport = true } = {}) {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const saved = await updateGlobalTasks(nextEnvelope)
      setSuccess('Salvo com sucesso.')
      if (autoExport) downloadJson('tarefas-globais.json', saved ?? nextEnvelope)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onAdd(e) {
    e.preventDefault()
    if (!isAdmin) return
    const title = form.title.trim()
    if (!title) return
    const now = Date.now()
    const nextTask = {
      id: newId(),
      subject: form.subject.trim(),
      title,
      description: form.description.trim(),
      dueDate: form.dueDate || '',
      priority: form.priority || 'medium',
      createdAt: now,
      updatedAt: now,
    }
    const next = { ...envelope, tasks: [nextTask, ...envelope.tasks] }
    await saveEnvelope(next, { autoExport: true })
    setForm((p) => ({ ...p, title: '', description: '' }))
  }

  async function onDelete(id) {
    if (!isAdmin) return
    const next = { ...envelope, tasks: envelope.tasks.filter((t) => t?.id !== id) }
    await saveEnvelope(next, { autoExport: true })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Adicione tarefas globais e exporte automaticamente em JSON.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadJson('tarefas-globais.json', envelope)}
          className="inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
        >
          <Download className="h-4 w-4" />
          Exportar
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-app bg-surface p-4">
        <div className="text-sm font-semibold text-app">Senha do admin</div>
        <p className="mt-1 text-xs text-muted">
          {adminConfigured
            ? 'Digite a senha para liberar as edições globais.'
            : 'Primeiro uso: digite uma senha para configurar o admin.'}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            value={adminDraft}
            onChange={(e) => setAdminDraft(e.target.value)}
            placeholder="ADMIN_PASSWORD"
            className="h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
          />
          {isAdmin ? (
            <button
              type="button"
              onClick={signOutAdmin}
              className="h-10 shrink-0 rounded-xl border border-app bg-surface px-3 text-sm font-medium text-app hover:bg-surface2"
            >
              Sair
            </button>
          ) : (
            <button
              type="button"
              disabled={adminBusy || !adminDraft.trim()}
              onClick={() => signInAdmin(adminDraft)}
              className={[
                'h-10 shrink-0 rounded-xl px-3 text-sm font-medium',
                adminBusy || !adminDraft.trim()
                  ? 'cursor-not-allowed bg-surface2 text-muted'
                  : 'btn-primary',
              ].join(' ')}
            >
              Entrar
            </button>
          )}
        </div>
        {adminAuthError ? <div className="mt-2 text-xs text-red-200">{adminAuthError}</div> : null}
      </div>

      <div className="mt-4 rounded-2xl border border-app bg-surface p-4">
        <div className="text-sm font-semibold text-app">Adicionar tarefa global</div>
        <p className="mt-1 text-xs text-muted">
          Ao salvar, o sistema baixa automaticamente o arquivo `tarefas-globais.json`.
        </p>

        <form onSubmit={onAdd} className="mt-4 space-y-3">
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

          {error ? <div className="text-xs text-red-200">{error}</div> : null}
          {success ? <div className="text-xs text-emerald-200">{success}</div> : null}

          <button
            type="submit"
            disabled={!isAdmin || busy}
            className={[
              'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
              !isAdmin || busy
                ? 'cursor-not-allowed bg-surface2 text-muted'
                : 'btn-primary',
            ].join(' ')}
          >
            <Plus className="h-4 w-4" />
            Adicionar tarefa
          </button>
        </form>
      </div>

      <div className="mt-4 space-y-3">
        {tasksSorted.map((t) => (
          <div key={t.id} className="rounded-2xl border border-app bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {t.subject ? (
                    <span className="rounded-full border border-app bg-surface2 px-2 py-0.5 text-xs text-app">
                      {t.subject}
                    </span>
                  ) : null}
                  {t.priority ? (
                    <span className="rounded-full border border-app bg-surface px-2 py-0.5 text-xs text-muted">
                      Prioridade: {t.priority}
                    </span>
                  ) : null}
                  {t.dueDate ? (
                    <span className="rounded-full border border-app bg-surface px-2 py-0.5 text-xs text-muted">
                      Entrega: {t.dueDate}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-app">{t.title}</div>
                {t.description ? (
                  <div className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!isAdmin || busy}
                onClick={() => onDelete(t.id)}
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app',
                  !isAdmin || busy ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface2',
                ].join(' ')}
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {tasksSorted.length === 0 ? (
          <div className="rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
            Nenhuma tarefa global cadastrada.
          </div>
        ) : null}
      </div>
    </div>
  )
}
