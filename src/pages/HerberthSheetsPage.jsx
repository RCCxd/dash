import { useMemo, useState } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useGlobalData } from '../state/global/globalDataContext.js'
import { newId } from '../utils/ids.js'

function normalizeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return { tasks: [], herberthSheets: [] }
  const tasks = Array.isArray(envelope.tasks) ? envelope.tasks : []
  const herberthSheets = Array.isArray(envelope.herberthSheets) ? envelope.herberthSheets : []
  return { ...envelope, tasks, herberthSheets }
}

function normalizeUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function normalizeSheet(item) {
  return {
    id: String(item?.id || '').trim() || newId(),
    title: String(item?.title || '').trim(),
    url: normalizeUrl(item?.url || ''),
    description: String(item?.description || '').trim(),
    createdAt: Number(item?.createdAt) || Date.now(),
  }
}

export default function HerberthSheetsPage() {
  const { tasks: globalTasks, updateGlobalTasks, isAdmin, storageConfigured } = useGlobalData()
  const envelope = useMemo(() => normalizeEnvelope(globalTasks), [globalTasks])

  const sheets = useMemo(() => {
    return envelope.herberthSheets
      .map(normalizeSheet)
      .filter((item) => item.title && item.url)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [envelope.herberthSheets])

  const [form, setForm] = useState({
    title: '',
    url: '',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function saveSheets(nextSheets) {
    setError('')
    setBusy(true)
    try {
      const next = { ...envelope, herberthSheets: nextSheets }
      await updateGlobalTasks(next)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onAdd(e) {
    e.preventDefault()
    if (!isAdmin || !storageConfigured) return

    const title = String(form.title || '').trim()
    const url = normalizeUrl(form.url)
    if (!title || !url) return

    const nextSheet = normalizeSheet({
      id: newId(),
      title,
      url,
      description: form.description,
      createdAt: Date.now(),
    })

    await saveSheets([nextSheet, ...sheets])
    setForm({ title: '', url: '', description: '' })
  }

  async function onDelete(id) {
    if (!isAdmin || !storageConfigured) return
    const nextSheets = sheets.filter((item) => item.id !== id)
    await saveSheets(nextSheets)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Fichas de Herberth</h1>
        <p className="mt-1 text-sm text-muted">Links para PDFs resolvidos.</p>
      </div>

      {isAdmin ? (
        <div className="mt-4 rounded-2xl border border-app bg-surface p-4">
          <div className="text-sm font-semibold text-app">Adicionar link</div>
          <form onSubmit={onAdd} className="mt-3 space-y-3">
            <label className="block">
              <div className="text-xs font-medium text-muted">Título *</div>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ex: Ficha 05 - Equações"
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-muted">Link do PDF *</div>
              <input
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder="https://..."
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-muted">Descrição</div>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="mt-1 w-full resize-none rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app placeholder:text-muted focus:outline-none"
              />
            </label>

            {error ? <div className="text-xs text-red-200">{error}</div> : null}

            <button
              type="submit"
              disabled={!isAdmin || busy || !storageConfigured}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                !isAdmin || busy || !storageConfigured
                  ? 'cursor-not-allowed bg-surface2 text-muted'
                  : 'btn-primary',
              ].join(' ')}
            >
              <Plus className="h-4 w-4" />
              Adicionar link
            </button>
          </form>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {sheets.length === 0 ? (
          <div className="rounded-2xl border border-app bg-surface p-4 text-sm text-muted">
            Nenhuma ficha cadastrada ainda.
          </div>
        ) : (
          sheets.map((item) => (
            <div key={item.id} className="rounded-2xl border border-app bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-app">{item.title}</div>
                  {item.description ? <div className="mt-1 text-sm text-muted">{item.description}</div> : null}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-(--primary) hover:underline"
                  >
                    Abrir PDF
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    disabled={busy || !storageConfigured}
                    onClick={() => onDelete(item.id)}
                    className={[
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-app bg-surface text-app',
                      busy || !storageConfigured ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface2',
                    ].join(' ')}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
