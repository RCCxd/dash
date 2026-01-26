function json(res, body, statusCode = 200, extraHeaders = {}) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function normalizeDayIndex(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return clamp(Math.trunc(n), 0, 6)
}

function normalizeTime(value) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return '08:00'
  const hh = clamp(Number(m[1]), 0, 23)
  const mm = clamp(Number(m[2]), 0, 59)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => Number(x))
  return h * 60 + m
}

function minutesToTime(min) {
  const hh = clamp(Math.floor(min / 60), 0, 23)
  const mm = clamp(min % 60, 0, 59)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) return []
  return events
    .map((e) => ({
      day: normalizeDayIndex(e.day),
      start: normalizeTime(e.start),
      end: normalizeTime(e.end),
      title: String(e.title || 'Estudo'),
    }))
    .map((e) => {
      const s = toMinutes(e.start)
      const en = toMinutes(e.end)
      if (en <= s) return { ...e, end: minutesToTime(s + 50) }
      return e
    })
    .slice(0, 64)
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null,
      content: String(m.content || '').trim(),
    }))
    .filter((m) => m.role && m.content)
    .slice(-12)
}

function localFallback(userText) {
  const title = 'Rotina sugerida (modo offline)'
  const reply =
    'Não encontrei uma OpenAI API Key. Configure em Configurações → IA ou defina OPENAI_API_KEY no deploy.'
  const events = [
    { day: 0, start: '19:00', end: '20:30', title: 'Foco: tarefa mais urgente' },
    { day: 2, start: '19:00', end: '20:00', title: 'Revisão: matérias da semana' },
    { day: 4, start: '18:30', end: '19:30', title: 'Leitura/Resumos' },
  ]
  return { title, reply, events, notes: [userText].filter(Boolean) }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}

module.exports = async (req, res) => {
  try {
    if ((req.method || 'POST') !== 'POST') return json(res, { ok: false, error: 'Método não suportado.' }, 405)

    const body = readBody(req)
    const tasks = Array.isArray(body.tasks) ? body.tasks : []
    const messages = sanitizeMessages(body.messages)

    const lastUserText =
      String(body.userText || '').trim() ||
      [...messages].reverse().find((m) => m.role === 'user')?.content ||
      ''

    if (!lastUserText) return json(res, { ok: false, error: 'messages/userText é obrigatório.' }, 400)

    const headers = req.headers || {}
    const headerKey = headers['x-openai-key'] || headers['X-OpenAI-Key']
    const apiKey = headerKey || process.env.OPENAI_API_KEY
    if (!apiKey) return json(res, { ok: true, source: 'fallback', ...localFallback(lastUserText) })

    const headerModel = headers['x-openai-model'] || headers['X-OpenAI-Model']
    const model = headerModel || process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const schema = {
      name: 'routine_plan',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          reply: { type: 'string' },
          notes: { type: 'array', items: { type: 'string' } },
          events: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                day: { type: 'integer', minimum: 0, maximum: 6 },
                start: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                end: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                title: { type: 'string' },
              },
              required: ['day', 'start', 'end', 'title'],
            },
          },
        },
        required: ['title', 'reply', 'events'],
      },
    }

    const tasksCompact = tasks.slice(0, 30).map((t) => ({
      subject: t.subject,
      title: t.title,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
    }))

    const system = [
      'Você é um assistente de planejamento de rotina de um estudante.',
      'Crie um plano semanal realista (Seg=0 ... Dom=6) com blocos de estudo e descanso.',
      'Se faltar disponibilidade, proponha 3 a 6 blocos curtos à noite.',
      'Use as tarefas para priorizar: prazos mais próximos e alta prioridade primeiro.',
      'Retorne APENAS JSON no formato do schema.',
      'Não crie eventos fora de 06:00–22:30. Use blocos de 25–90min.',
      '',
      'Tarefas atuais (pode ser vazio):',
      JSON.stringify(tasksCompact),
    ].join('\n')

    const input = [{ role: 'system', content: system }, ...messages]
    if (messages.length === 0) input.push({ role: 'user', content: lastUserText })

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        response_format: { type: 'json_schema', json_schema: schema },
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return json(res, { ok: false, error: `OpenAI: ${resp.status} ${text}` }, 502)
    }

    const data = await resp.json()
    const content = data?.output?.[0]?.content?.[0]?.text
    if (!content) return json(res, { ok: false, error: 'Resposta inválida do modelo.' }, 502)

    const parsed = JSON.parse(content)
    const events = normalizeEvents(parsed.events)

    return json(res, {
      ok: true,
      source: 'openai',
      title: String(parsed.title || 'Rotina sugerida'),
      reply: String(parsed.reply || ''),
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
      events,
    })
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}

