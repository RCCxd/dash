import { useEffect, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { downloadJson } from '../utils/download.js'

export default function AdminJsonPanel({
  title,
  description,
  value,
  onSave,
  autoExportOnSave = false,
  exportFilename,
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value || {}, null, 2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const filename = String(exportFilename || title || 'admin-export')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  useEffect(() => {
    setDraft(JSON.stringify(value || {}, null, 2))
  }, [value])

  async function onSubmit() {
    setError('')
    setBusy(true)
    try {
      const parsed = JSON.parse(draft)
      const saved = await onSave(parsed)
      if (autoExportOnSave) downloadJson(`${filename || 'admin-export'}.json`, saved ?? parsed)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-app bg-surface p-4">
      <div className="text-sm font-semibold text-app">{title}</div>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={10}
        className="mt-3 w-full resize-none rounded-2xl border border-app bg-surface px-3 py-2 font-mono text-xs text-app placeholder:text-muted focus:outline-none"
      />
      {error ? <div className="mt-2 text-xs text-red-200">{error}</div> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => downloadJson(`${filename || 'admin-export'}.json`, draft)}
          className="inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm font-medium text-app hover:bg-surface2"
        >
          <Download className="h-4 w-4" />
          Exportar JSON
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
            busy
              ? 'cursor-not-allowed bg-surface2 text-muted'
              : 'btn-primary',
          ].join(' ')}
        >
          <Save className="h-4 w-4" />
          Salvar global
        </button>
      </div>
    </div>
  )
}
