import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { useGlobalData } from '../state/global/globalDataContext.js'
import { newId } from '../utils/ids.js'
import { downloadJson } from '../utils/download.js'

const PRIORITIES = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'MÃ©dia' },
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

function normalizeGlobalTask(input) {
  const now = Date.now()
  const id = String(input?.id || '').trim() || newId()
  const createdAt = Number.isFinite(Number(input?.createdAt)) ? Number(input.createdAt) : now
  const updatedAt = Number.isFinite(Number(input?.updatedAt)) ? Number(input.updatedAt) : now
  const priority = input?.priority === 'high' || input?.priority === 'low' ? input.priority : 'medium'
  return {
    id,
    subject: String(input?.subject || ''),
    title: String(input?.title || ''),
    description: String(input?.description || ''),
    dueDate: String(input?.dueDate || ''),
    priority,
    createdAt,
    updatedAt,
  }
}

export default function AdminPage() {
  const {
    tasks: globalTasks,
    updateGlobalTasks,
    isAdmin,
    authRequired,
    adminOk,
    storageConfigured,
    storeKind,
    source,
    adminPassword,
    setAdminPassword,
  } = useGlobalData()
  const envelope = useMemo(() => normalizeEnvelope(globalTasks), [globalTasks])
  const tasksSorted = useMemo(() => sortGlobalTasks(envelope.tasks), [envelope.tasks])

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
  const [autoExport, setAutoExport] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({
    subject: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
  })

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function setEdit(name, value) {
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  function openEdit(task) {
    if (!task) return
    setEditing(task)
    setEditForm({
      subject: task.subject || '',
      title: task.title || '',
      description: task.description || '',
      dueDate: task.dueDate || '',
      priority: task.priority || 'medium',
    })
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditing(null)
  }

  async function saveEnvelope(nextEnvelope, { autoExport = true } = {}) {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const saved = await updateGlobalTasks(nextEnvelope)
      setSuccess('Atualizado localmente. Exporte e atualize o repo (public/tarefas-globais.json).')
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
    await saveEnvelope(next, { autoExport })
    setForm((p) => ({ ...p, title: '', description: '' }))
  }

  async function onDelete(id) {
    if (!isAdmin) return
    const next = { ...envelope, tasks: envelope.tasks.filter((t) => t?.id !== id) }
    await saveEnvelope(next, { autoExport })
  }

  async function onSaveEdit(e) {
    e.preventDefault()
    if (!isAdmin) return

    const title = String(editForm.title || '').trim()
    if (!title) return

    const taskId = String(editing?.id || '').trim()
    if (!taskId) return

    const now = Date.now()
    const nextTask = normalizeGlobalTask({
      ...(editing || {}),
      subject: String(editForm.subject || '').trim(),
      title,
      description: String(editForm.description || '').trim(),
      dueDate: editForm.dueDate || '',
      priority: editForm.priority || 'medium',
      updatedAt: now,
    })

    const next = { ...envelope, tasks: envelope.tasks.map((t) => (t?.id === taskId ? nextTask : t)) }
    await saveEnvelope(next, { autoExport })
    closeEdit()
  }

  async function onImportFile(e) {
    const file = e?.target?.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!isAdmin) return

    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const imported = Array.isArray(parsed) ? { tasks: parsed } : normalizeEnvelope(parsed)
      const tasksImported = Array.isArray(imported.tasks) ? imported.tasks : []
      const normalized = tasksImported.map(normalizeGlobalTask)
      const next = { ...envelope, ...imported, tasks: normalized }
      const saved = await updateGlobalTasks(next)
      setSuccess('Importado no rascunho local. Exporte e atualize o repo (public/tarefas-globais.json).')
      if (autoExport) downloadJson('tarefas-globais.json', saved ?? next)
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="dash-enter flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Admin</h1>
          <p className="mt-1 text-sm text-muted">
            Adicione tarefas globais e exporte automaticamente em JSON.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            className={[
              'dash-tab inline-flex cursor-pointer items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm',
              !isAdmin || busy
                ? 'cursor-not-allowed bg-surface2 text-muted'
                : 'text-app hover:bg-surface2',
            ].join(' ')}
          >
            <input
              type="file"
              accept="application/json"
              onChange={onImportFile}
              disabled={!isAdmin || busy}
              className="hidden"
            />
            <Upload className="h-4 w-4" />
            Importar
          </label>

          <button
            type="button"
            onClick={() => downloadJson('tarefas-globais.json', envelope)}
            className="dash-tab inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="dash-card dash-enter mt-4 rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '40ms' }}>
        <div className="text-sm font-semibold text-app">Senha do admin</div>
        <p className="mt-1 text-xs text-muted">
          {source === 'api'
            ? authRequired
              ? 'Digite a senha configurada em ADMIN_PASSWORD no backend (somente ela libera salvar/importar).'
              : 'Backend sem senha (ADMIN_PASSWORD nÃ£o configurada).'
            : 'Modo local: alteracoes salvas no navegador e exportaveis em JSON.'}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            value={adminPassword || ''}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder={source === 'api' && authRequired ? 'Senha do admin' : 'Senha'}
            className="h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
          />
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setAdminPassword('')}
              className="dash-tab h-10 shrink-0 rounded-xl border border-app bg-surface px-3 text-sm font-medium text-app hover:bg-surface2"
            >
              Sair
            </button>
          ) : null}
        </div>
        {authRequired && adminPassword && !adminOk ? (
          <div className="mt-2 text-xs text-red-200">
            Senha incorreta para este backend. Sem a senha certa vocÃª nÃ£o consegue salvar/importar.
          </div>
        ) : null}
        <div className="mt-2 text-xs text-muted">
          Base global: {storageConfigured ? storeKind : 'nÃ£o configurado'}.
        </div>
        {!storageConfigured ? (
          <div className="mt-1 text-xs text-muted">
            Para "salvar para todos", conecte um Redis (Upstash). Sem isso pode resetar.
          </div>
        ) : null}
      </div>

      <div className="dash-card dash-enter mt-4 rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '90ms' }}>
        <div className="text-sm font-semibold text-app">Adicionar tarefa global</div>
        <p className="mt-1 text-xs text-muted">
          Ao salvar, este painel atualiza um rascunho local. Para valer para todos, exporte e substitua `public/tarefas-globais.json` no repo (commit + deploy).
        </p>
        <label className="mt-3 inline-flex select-none items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={autoExport}
            onChange={(e) => setAutoExport(e.target.checked)}
            className="h-4 w-4 rounded border border-app bg-surface text-(--primary)"
          />
          Baixar `tarefas-globais.json` automaticamente ao salvar/importar
        </label>

        <form onSubmit={onAdd} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-xs font-medium text-muted">MatÃ©ria</div>
              <input
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="Ex: MatemÃ¡tica"
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
            <div className="text-xs font-medium text-muted">TÃ­tulo *</div>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex: Lista de exercÃ­cios 3"
              className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-muted">DescriÃ§Ã£o</div>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Detalhes, links, pÃ¡ginas..."
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
              'dash-tab inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
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
        {tasksSorted.map((t, index) => (
          <div key={t.id} className="dash-card dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: `${index * 45}ms` }}>
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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={!isAdmin || busy}
                  onClick={() => openEdit(t)}
                  className={[
                    'dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app',
                    !isAdmin || busy
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-surface2',
                  ].join(' ')}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || busy}
                  onClick={() => onDelete(t.id)}
                  className={[
                    'dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app',
                    !isAdmin || busy
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-surface2',
                  ].join(' ')}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {tasksSorted.length === 0 ? (
          <div className="dash-enter rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
            Nenhuma tarefa global cadastrada.
          </div>
        ) : null}
      </div>

      {editOpen ? (
        <div className="dash-overlay-in fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="dash-modal-in w-full max-w-lg overflow-hidden rounded-2xl border border-app bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-app px-4 py-3">
              <div className="text-sm font-semibold text-app">Editar tarefa global</div>
              <button
                type="button"
                onClick={closeEdit}
                className="dash-tab inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app hover:bg-surface2"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSaveEdit} className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="text-xs font-medium text-muted">MatÃ©ria</div>
                  <input
                    value={editForm.subject}
                    onChange={(e) => setEdit('subject', e.target.value)}
                    placeholder="Ex: MatemÃ¡tica"
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-medium text-muted">Data de entrega</div>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEdit('dueDate', e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs font-medium text-muted">TÃ­tulo *</div>
                <input
                  value={editForm.title}
                  onChange={(e) => setEdit('title', e.target.value)}
                  placeholder="Ex: Lista de exercÃ­cios 3"
                  className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-muted">DescriÃ§Ã£o</div>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEdit('description', e.target.value)}
                  rows={3}
                  placeholder="Detalhes, links, pÃ¡ginas..."
                  className="mt-1 w-full resize-none rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app placeholder:text-muted focus:outline-none"
                />
              </label>

              <label className="block">
                <div className="text-xs font-medium text-muted">Prioridade</div>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEdit('priority', e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app focus:outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={!isAdmin || busy}
                className={[
                  'dash-tab h-10 w-full rounded-xl text-sm font-medium',
                  !isAdmin || busy
                    ? 'cursor-not-allowed bg-surface2 text-muted'
                    : 'btn-primary',
                ].join(' ')}
              >
                Salvar alteraÃ§Ãµes
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

