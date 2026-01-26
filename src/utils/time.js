export function formatISODate(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatDueDateLabel(dueDate) {
  if (!dueDate) return ''
  const [y, m, d] = dueDate.split('-').map((x) => Number(x))
  if (!y || !m || !d) return ''
  const due = new Date(y, m - 1, d)

  const today = new Date()
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const du = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const deltaDays = Math.round((du - t) / (24 * 60 * 60 * 1000))

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(due)

  if (deltaDays === 0) return `Entrega: hoje (${formatted})`
  if (deltaDays === 1) return `Entrega: amanhã (${formatted})`
  if (deltaDays === -1) return `Entrega: ontem (${formatted})`
  if (deltaDays > 1) return `Entrega: em ${deltaDays} dias (${formatted})`
  return `Entrega: há ${Math.abs(deltaDays)} dias (${formatted})`
}

