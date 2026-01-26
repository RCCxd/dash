const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function formatWeekdayShort(dayIndex) {
  const i = Number(dayIndex)
  if (!Number.isFinite(i) || i < 0 || i > 6) return 'Dia'
  return DAYS_SHORT[i]
}

