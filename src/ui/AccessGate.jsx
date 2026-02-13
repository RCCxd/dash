import { useState } from 'react'
import { useAccess } from '../state/access/accessContext.js'

export default function AccessGate({ children }) {
  const { loading, authEnabled, authenticated, account, error, login } = useAccess()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      await login(username, password)
      setPassword('')
    } catch (err) {
      setFormError(err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app bg-app-animated">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
          <div className="dash-card w-full rounded-2xl border border-app bg-surface p-5 text-sm text-muted">
            Validando acesso...
          </div>
        </div>
      </div>
    )
  }

  if (!authEnabled || authenticated) return children

  return (
    <div className="min-h-screen bg-app bg-app-animated">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <div className="dash-card w-full rounded-2xl border border-app bg-surface p-5">
          <h1 className="text-lg font-semibold tracking-tight text-app">Acesso ao Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Entre com a conta da assinatura mensal para liberar o painel.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <label className="block">
              <div className="text-xs font-medium text-muted">Usuario</div>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: Felipe"
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                required
              />
            </label>

            <label className="block">
              <div className="text-xs font-medium text-muted">Senha</div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
                required
              />
            </label>

            {formError ? <div className="text-xs text-red-200">{formError}</div> : null}
            {error ? <div className="text-xs text-red-200">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              className={[
                'dash-tab h-10 w-full rounded-xl text-sm font-medium',
                submitting ? 'cursor-not-allowed bg-surface2 text-muted' : 'btn-primary',
              ].join(' ')}
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {account?.username ? (
            <div className="mt-3 text-xs text-muted">Conta ativa: {account.username}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
