const SLOT_DEFS = [
  { start: '07:10', end: '08:00', subjects: ['LINGUA INGLESA', 'FISICA', 'MATEMATICA', 'FISICA', 'BIOLOGIA'] },
  { start: '08:00', end: '08:45', subjects: ['HISTORIA', 'HISTORIA', 'MATEMATICA', 'FISICA', 'MATEMATICA'] },
  { start: '08:45', end: '09:30', subjects: ['INTERIORIDADE E PV', 'HISTORIA', 'QUIMICA', 'FILOSOFIA', 'MATEMATICA'] },
  { start: '10:00', end: '10:45', subjects: ['LINGUA PORTUGUESA', 'IFA', 'GEOGRAFIA', 'SOCIOLOGIA', 'ARTE'] },
  { start: '10:45', end: '11:30', subjects: ['IFA', 'IFA', 'GEOGRAFIA', 'BIOLOGIA', 'LINGUA PORTUGUESA'] },
  { start: '11:30', end: '12:15', subjects: ['IFA', 'IFA', 'PRODUCAO TEXTUAL', 'BIOLOGIA', 'GEOGRAFIA'] },
  { start: '14:00', end: '14:45', subjects: ['QUIMICA', '', '', 'PROVA', ''] },
  { start: '14:45', end: '15:30', subjects: ['QUIMICA', '', '', 'PROVA', ''] },
  { start: '16:00', end: '16:45', subjects: ['PRODUCAO TEXTUAL', '', '', 'LITERATURA', ''] },
  { start: '16:45', end: '17:30', subjects: ['PRODUCAO TEXTUAL', '', '', 'LITERATURA', ''] },
]

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const SHARED_ROUTINE_EVENTS = SLOT_DEFS.flatMap((slot) => {
  return slot.subjects
    .map((title, day) => {
      const trimmed = String(title || '').trim()
      if (!trimmed) return null

      return {
        id: `shared-${day}-${slot.start.replace(':', '')}-${slug(trimmed)}`,
        day,
        start: slot.start,
        end: slot.end,
        title: trimmed,
        createdAt: 0,
        source: 'shared',
      }
    })
    .filter(Boolean)
})

