import { createElement } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BookOpenCheck, CalendarCheck2, LayoutDashboard, Settings, Shield, Timer } from 'lucide-react'
import { useGlobalData } from '../state/global/globalDataContext.js'

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'dash-tab flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
          'transition-colors',
          isActive
            ? 'bg-surface2 text-app'
            : 'text-muted hover:bg-surface2 hover:text-app',
        ].join(' ')
      }
    >
      {createElement(icon, { className: 'h-4 w-4' })}
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export default function AppShell({ children }) {
  const location = useLocation()
  const { isAdmin } = useGlobalData()
  const active = location.pathname
  const onDashboard = active === '/'
  const onStudy = active.startsWith('/estudos')
  const onRoutine = active.startsWith('/rotina')
  const onHerberthSheets = active.startsWith('/fichas-herberth')
  const onSettings = active.startsWith('/configuracoes')
  const onAdmin = active.startsWith('/admin')

  return (
    <div className="min-h-full bg-app bg-app-animated" lang="pt-BR" spellCheck autoCorrect="on">
      <div className="mx-auto flex w-full max-w-5xl">
        <aside className="dash-enter hidden w-64 shrink-0 border-r border-app px-4 py-6 md:block" style={{ animationDelay: '20ms' }}>
          <div className="text-sm font-semibold tracking-tight text-app">
            Tarefas do Estudante
          </div>
          <p className="mt-1 text-xs text-muted">Tarefas e rotina.</p>
          <nav className="mt-5 space-y-1">
            <NavItem to="/" icon={LayoutDashboard} label="Tarefas" />
            <NavItem to="/estudos" icon={Timer} label="Estudos" />
            <NavItem to="/rotina" icon={CalendarCheck2} label="Rotina" />
            <NavItem to="/fichas-herberth" icon={BookOpenCheck} label="Fichas de Herberth" />
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
            {isAdmin ? <NavItem to="/admin" icon={Shield} label="Admin" /> : null}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="dash-enter fixed bottom-0 left-0 right-0 z-20 border-t border-app bg-app backdrop-blur md:hidden" style={{ animationDelay: '20ms' }}>
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-4 safe-bottom">
          <NavLink
            to="/"
            className={[
              'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
              onDashboard ? 'text-app' : 'text-muted',
            ].join(' ')}
          >
            <LayoutDashboard className="h-5 w-5" />
            Tarefas
          </NavLink>
          <NavLink
            to="/estudos"
            className={[
              'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
              onStudy ? 'text-app' : 'text-muted',
            ].join(' ')}
          >
            <Timer className="h-5 w-5" />
            Estudos
          </NavLink>
          <NavLink
            to="/rotina"
            className={[
              'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
              onRoutine ? 'text-app' : 'text-muted',
            ].join(' ')}
          >
            <CalendarCheck2 className="h-5 w-5" />
            Rotina
          </NavLink>
          <NavLink
            to="/fichas-herberth"
            className={[
              'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
              onHerberthSheets ? 'text-app' : 'text-muted',
            ].join(' ')}
          >
            <BookOpenCheck className="h-5 w-5" />
            Fichas
          </NavLink>
          <NavLink
            to="/configuracoes"
            className={[
              'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
              onSettings ? 'text-app' : 'text-muted',
            ].join(' ')}
          >
            <Settings className="h-5 w-5" />
            Config.
          </NavLink>
          {isAdmin ? (
            <NavLink
              to="/admin"
              className={[
                'dash-tab flex flex-1 flex-col items-center gap-1 py-3 text-xs',
                onAdmin ? 'text-app' : 'text-muted',
              ].join(' ')}
            >
              <Shield className="h-5 w-5" />
              Admin
            </NavLink>
          ) : null}
        </div>
      </nav>
    </div>
  )
}
