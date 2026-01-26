function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

export function normalizeHex(input) {
  const raw = String(input || '').trim()
  const m = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let hex = m[1].toLowerCase()
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return `#${hex}`
}

function hexToRgb(hex) {
  const n = normalizeHex(hex)
  if (!n) return null
  const r = Number.parseInt(n.slice(1, 3), 16)
  const g = Number.parseInt(n.slice(3, 5), 16)
  const b = Number.parseInt(n.slice(5, 7), 16)
  return { r, g, b }
}

function rgbToHex({ r, g, b }) {
  const to = (x) => String(Math.round(Math.max(0, Math.min(255, x))).toString(16)).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function mix(hexA, hexB, weightB) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return normalizeHex(hexA) || '#000000'
  const w = clamp01(weightB)
  return rgbToHex({
    r: a.r * (1 - w) + b.r * w,
    g: a.g * (1 - w) + b.g * w,
    b: a.b * (1 - w) + b.b * w,
  })
}

function toLinear(c) {
  const n = c / 255
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function bestTextOn(hex) {
  const l = luminance(hex)
  return l > 0.55 ? '#0b1220' : '#ffffff'
}

