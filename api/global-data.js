const fs = require('fs/promises')
const path = require('path')
const { getStore } = require('./_lib/store')
const { ensureAuthenticatedAccess, readBody } = require('./_lib/access-control')

function json(res, body, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function normalizeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return { tasks: [] }
  const tasks = Array.isArray(envelope.tasks) ? envelope.tasks : []
  return { ...envelope, tasks }
}

function getConfiguredAdminPassword() {
  const v = process.env.ADMIN_PASSWORD
  return v && String(v).trim() ? String(v).trim() : ''
}

function readHeader(req, name) {
  const headers = req.headers || {}
  const target = String(name).toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v
  }
  return undefined
}

function isAdminAuthorized(req) {
  const configured = getConfiguredAdminPassword()
  if (!configured) return false
  const provided = readHeader(req, 'x-admin-password')
  return Boolean(provided && String(provided).trim() === configured)
}

function defaultTasks() {
  return { tasks: [] }
}

async function readPublicGlobalTasksJson() {
  const file = path.join(process.cwd(), 'public', 'tarefas-globais.json')
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return normalizeEnvelope(parsed)
  } catch {
    return null
  }
}

const KEY_TASKS = 'global.tasks.v1'

module.exports = async (req, res) => {
  try {
    const method = req.method || 'GET'
    const store = await getStore()
    const adminPasswordConfigured = Boolean(getConfiguredAdminPassword())
    const storageConfigured = store.kind !== 'file-tmp'
    const access = await ensureAuthenticatedAccess(req, store)

    if (!access.ok) {
      return json(
        res,
        {
          ok: false,
          error: access.error,
          authEnabled: Boolean(access.state?.enabled),
          authenticated: Boolean(access.state?.authenticated),
        },
        access.statusCode,
      )
    }

    if (method === 'GET') {
      const stored = await store.get(KEY_TASKS)
      const fromPublic = stored ? null : await readPublicGlobalTasksJson()
      const tasks = normalizeEnvelope(stored || fromPublic || defaultTasks())
      return json(res, {
        ok: true,
        tasks,
        storageConfigured,
        store: store.kind,
        authRequired: adminPasswordConfigured,
        adminOk: adminPasswordConfigured ? isAdminAuthorized(req) : false,
      })
    }

    if (method === 'PUT') {
      if (!adminPasswordConfigured) {
        return json(
          res,
          {
            ok: false,
            error:
              'ADMIN_PASSWORD nao configurada no backend. Configure para liberar edicao global.',
          },
          403,
        )
      }

      if (!isAdminAuthorized(req)) {
        return json(
          res,
          {
            ok: false,
            error:
              'Nao autorizado. Envie o header x-admin-password (e configure ADMIN_PASSWORD no deploy).',
          },
          401,
        )
      }

      const body = readBody(req)
      const { tasks } = body || {}

      if (tasks) await store.set(KEY_TASKS, tasks)

      const stored = await store.get(KEY_TASKS)
      const fromPublic = stored ? null : await readPublicGlobalTasksJson()
      const nextTasks = normalizeEnvelope(stored || fromPublic || defaultTasks())
      return json(res, {
        ok: true,
        tasks: nextTasks,
        storageConfigured,
        store: store.kind,
        authRequired: adminPasswordConfigured,
        adminOk: adminPasswordConfigured ? isAdminAuthorized(req) : false,
      })
    }

    return json(res, { ok: false, error: 'Metodo nao suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
