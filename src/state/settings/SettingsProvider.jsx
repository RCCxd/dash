import { useEffect, useMemo, useState } from 'react'
import { SettingsContext } from './settingsContext.js'
import { getStoredJSON, setStoredJSON } from '../../utils/storage.js'
import { bestTextOn, mix, normalizeHex } from '../../utils/colors.js'

const SETTINGS_KEY = 'studentDashboard.settings.v1'

const DEFAULTS = {
  themeMode: 'marista', // marista | light | dark | custom
  customPrimary: '#2563eb',
  customBackground: '#0b1220',
  fontSize: 'md', // sm | md | lg
  highContrast: false,
  defaultTaskFilter: 'pending', // all | pending | done
}

function buildPalette(settings) {
  const mode = settings.themeMode
  const highContrast = Boolean(settings.highContrast)

  if (mode === 'light') {
    return {
      scheme: 'light',
      bg: '#f8fafc',
      surface: '#ffffff',
      surface2: '#f1f5f9',
      border: highContrast ? '#94a3b8' : '#e2e8f0',
      text: '#0f172a',
      muted: '#475569',
      muted2: '#64748b',
      primary: '#2563eb',
    }
  }

  if (mode === 'dark') {
    return {
      scheme: 'dark',
      bg: '#09090b',
      surface: '#0c0c10',
      surface2: '#11111a',
      border: highContrast ? '#52525b' : '#27272a',
      text: '#fafafa',
      muted: '#a1a1aa',
      muted2: '#71717a',
      primary: '#3b82f6',
    }
  }

  if (mode === 'custom') {
    const bg = normalizeHex(settings.customBackground) || DEFAULTS.customBackground
    const primary = normalizeHex(settings.customPrimary) || DEFAULTS.customPrimary
    const text = bestTextOn(bg)
    const surface = mix(bg, text, 0.08)
    const surface2 = mix(bg, text, 0.14)
    const border = mix(bg, text, highContrast ? 0.28 : 0.18)
    const muted = mix(text, bg, 0.35)
    const muted2 = mix(text, bg, 0.5)
    const scheme = bestTextOn(bg) === '#0b1220' ? 'light' : 'dark'
    return { scheme, bg, surface, surface2, border, text, muted, muted2, primary }
  }

  // marista (padrão)
  return {
    scheme: 'dark',
    bg: '#071629',
    surface: '#0b1f35',
    surface2: '#0f2a46',
    border: highContrast ? '#2b5a89' : '#1a3a5d',
    text: '#eaf3ff',
    muted: '#a8c0dc',
    muted2: '#7fa1c4',
    primary: '#0b5ed7',
  }
}

function fontSizePx(fontSize) {
  if (fontSize === 'sm') return '14px'
  if (fontSize === 'lg') return '18px'
  return '16px'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const stored = getStoredJSON(SETTINGS_KEY, null)
    return { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) }
  })

  useEffect(() => {
    setStoredJSON(SETTINGS_KEY, settings)
  }, [settings])

  useEffect(() => {
    const palette = buildPalette(settings)
    const root = document.documentElement

    root.style.colorScheme = palette.scheme
    root.dataset.theme = settings.themeMode || 'marista'
    root.style.fontSize = fontSizePx(settings.fontSize)

    root.style.setProperty('--bg', palette.bg)
    root.style.setProperty('--surface', palette.surface)
    root.style.setProperty('--surface2', palette.surface2)
    root.style.setProperty('--border', palette.border)
    root.style.setProperty('--text', palette.text)
    root.style.setProperty('--muted', palette.muted)
    root.style.setProperty('--muted2', palette.muted2)
    root.style.setProperty('--primary', palette.primary)
    root.style.setProperty('--on-primary', bestTextOn(palette.primary))
  }, [settings])

  const api = useMemo(() => {
    return {
      settings,
      setSettings,
      updateSettings(patch) {
        setSettings((prev) => ({ ...prev, ...(patch || {}) }))
      },
      resetSettings() {
        setSettings(DEFAULTS)
      },
    }
  }, [settings])

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}
