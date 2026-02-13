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

function getAllowedAdminUsername() {
  const v = process.env.ADMIN_ALLOWED_USERNAME
  if (v && String(v).trim()) return String(v).trim()
  return 'RCCxd'
}

function normalizeUsername(input) {
  return String(input || '').trim().toLowerCase()
}

function isAdminAuthorized(accessState) {
  const requiredUsername = normalizeUsername(getAllowedAdminUsername())
  const requesterUsername = normalizeUsername(accessState?.account?.username)
  return Boolean(requiredUsername && requesterUsername === requiredUsername)
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
        authRequired: false,
        adminOk: isAdminAuthorized(access.state),
        adminUser: getAllowedAdminUsername(),
      })
    }

    if (method === 'PUT') {
      if (!isAdminAuthorized(access.state)) {
        return json(
          res,
          {
            ok: false,
            error:
              `Nao autorizado. Apenas o usuario ${getAllowedAdminUsername()} pode editar tarefas globais.`,
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
        authRequired: false,
        adminOk: isAdminAuthorized(access.state),
        adminUser: getAllowedAdminUsername(),
      })
    }

    return json(res, { ok: false, error: 'Metodo nao suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
