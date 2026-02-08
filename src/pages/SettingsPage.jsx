import { createElement, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Palette, RotateCcw, Shield, Sliders } from 'lucide-react'
import { useSettings } from '../state/settings/settingsContext.js'
import { useGlobalData } from '../state/global/globalDataContext.js'
import { normalizeHex } from '../utils/colors.js'

function Section({ icon, title, description, children, delay = 0 }) {
  return (
    <section className="dash-card dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface2 text-app">
          {createElement(icon, { className: 'h-5 w-5' })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-app">{title}</div>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ModeButton({ active, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'dash-tab w-full rounded-2xl border px-4 py-3 text-left transition-colors',
        active ? 'border-app bg-surface2' : 'border-app bg-surface hover:bg-surface2',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-app">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-muted">{subtitle}</div> : null}
        </div>
        {active ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-(--primary) text-(--on-primary)">
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </button>
  )
}

function HexPicker({ label, value, onChange }) {
  const normalized = useMemo(() => normalizeHex(value) || '', [value])
  const [raw, setRaw] = useState(value)

  function commit(next) {
    setRaw(next)
    const n = normalizeHex(next)
    if (n) onChange(n)
  }

  return (
    <label className="block">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={normalized || '#000000'}
          onChange={(e) => commit(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-xl border border-app bg-surface p-1"
          aria-label={label}
        />
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          placeholder="#RRGGBB"
          className="h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted focus:outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-xs text-muted">{normalized ? normalized.toUpperCase() : 'InvÃ¡lido'}</div>
        <div className="inline-flex items-center gap-2 text-xs text-muted">
          <span
            className="h-4 w-4 rounded border border-app"
            style={{ background: normalized || 'transparent' }}
          />
          PrÃ©via
        </div>
      </div>
    </label>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const {
    isAdmin,
    adminPassword,
    setAdminPassword,
    authRequired,
    source,
    storageConfigured,
    storeKind,
  } = useGlobalData()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-6">
      <div className="dash-enter flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">
            ConfiguraÃ§Ãµes
          </h1>
          <p className="mt-1 text-sm text-muted">Ajuste aparÃªncia e comportamento do app.</p>
        </div>
        <button
          type="button"
          onClick={resetSettings}
          className="dash-tab inline-flex items-center gap-2 rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app hover:bg-surface2"
        >
          <RotateCcw className="h-4 w-4" />
          Resetar
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Section
          delay={40}
          icon={Palette}
          title="AparÃªncia"
          description="Modo Marista (azul), claro, escuro ou personalizado."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ModeButton
              active={settings.themeMode === 'marista'}
              title="Normal (Marista)"
              subtitle="Azul Marista (padrÃ£o)"
              onClick={() => updateSettings({ themeMode: 'marista' })}
            />
            <ModeButton
              active={settings.themeMode === 'light'}
              title="Claro"
              subtitle="Para salas mais iluminadas"
              onClick={() => updateSettings({ themeMode: 'light' })}
            />
            <ModeButton
              active={settings.themeMode === 'dark'}
              title="Escuro"
              subtitle="Menos brilho Ã  noite"
              onClick={() => updateSettings({ themeMode: 'dark' })}
            />
            <ModeButton
              active={settings.themeMode === 'custom'}
              title="Personalizado"
              subtitle="Escolha suas cores"
              onClick={() => updateSettings({ themeMode: 'custom' })}
            />
          </div>

          {settings.themeMode === 'custom' ? (
            <div className="mt-4 space-y-4">
              <HexPicker
                label="Cor primÃ¡ria (botÃµes/links)"
                value={settings.customPrimary}
                onChange={(hex) => updateSettings({ customPrimary: hex })}
              />
              <HexPicker
                label="Cor de fundo"
                value={settings.customBackground}
                onChange={(hex) => updateSettings({ customBackground: hex })}
              />
            </div>
          ) : null}

          <div className="dash-card mt-4 rounded-2xl border border-app bg-surface p-4">
            <div className="text-xs font-medium text-muted">PrÃ©via</div>
            <div className="dash-card mt-3 rounded-2xl border border-app bg-surface2 p-4">
              <div className="text-sm font-semibold text-app">Card de exemplo</div>
              <p className="mt-1 text-xs text-muted">Texto secundÃ¡rio e um botÃ£o primÃ¡rio.</p>
              <button
                type="button"
                className="dash-tab mt-3 rounded-xl px-3 py-2 text-sm font-medium btn-primary"
              >
                BotÃ£o
              </button>
            </div>
          </div>
        </Section>

        <Section delay={90} icon={Sliders} title="OpÃ§Ãµes" description="PreferÃªncias de uso do dia a dia.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="dash-card rounded-2xl border border-app bg-surface p-4">
              <div className="text-sm font-semibold text-app">Fonte</div>
              <p className="mt-1 text-xs text-muted">Tamanho do texto no app.</p>
              <select
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: e.target.value })}
                className="mt-3 w-full rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app focus:outline-none"
              >
                <option value="sm">Pequena</option>
                <option value="md">Normal</option>
                <option value="lg">Grande</option>
              </select>
            </label>

            <label className="dash-card rounded-2xl border border-app bg-surface p-4">
              <div className="text-sm font-semibold text-app">Filtro padrÃ£o (tarefas)</div>
              <p className="mt-1 text-xs text-muted">Ao abrir Tarefas.</p>
              <select
                value={settings.defaultTaskFilter}
                onChange={(e) => updateSettings({ defaultTaskFilter: e.target.value })}
                className="mt-3 w-full rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app focus:outline-none"
              >
                <option value="pending">Pendentes</option>
                <option value="all">Tudo</option>
                <option value="done">ConcluÃ­das</option>
              </select>
            </label>

            <label className="dash-card rounded-2xl border border-app bg-surface p-4">
              <div className="text-sm font-semibold text-app">Alto contraste</div>
              <p className="mt-1 text-xs text-muted">Bordas mais visÃ­veis.</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-app">Ativar</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.highContrast)}
                  onChange={(e) => updateSettings({ highContrast: e.target.checked })}
                  className="h-5 w-5 rounded border border-app bg-surface text-(--primary)"
                />
              </div>
            </label>
          </div>
        </Section>

        <Section
          delay={140}
          icon={Shield}
          title="AdministraÃ§Ã£o"
          description="NÃ£o Mexa."
        >
          <div className="dash-card rounded-2xl border border-app bg-surface p-4">
            <div className="text-sm font-semibold text-app">Senha do admin</div>
            <p className="mt-1 text-xs text-muted">
              {source === 'api'
                ? authRequired
                  ? 'Digite a senha.'
                  : 'Backend sem senha.'
                : 'Admin requer backend.'}
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
            <div className="mt-2 text-xs text-muted">
              Base global: {storageConfigured ? storeKind : 'nÃ£o configurado'}.
            </div>
          </div>

          <div className="dash-card mt-4 rounded-2xl border border-app bg-surface p-4">
            <div className="text-sm font-semibold text-app">Painel do admin</div>
            <p className="mt-1 text-xs text-muted">
              No painel vocÃª adiciona/edita/importa tarefas globais e exporta o JSON.
            </p>
            <div className="mt-3 flex items-center justify-end">
              <Link
                to="/admin"
                className={[
                  'dash-tab inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                  isAdmin ? 'btn-primary' : 'pointer-events-none bg-surface2 text-muted',
                ].join(' ')}
              >
                Abrir Admin
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}


