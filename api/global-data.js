const fs = require('fs/promises')
const path = require('path')

function json(res, body, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
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
  if (!configured) return true
  const provided = readHeader(req, 'x-admin-password')
  return Boolean(provided && String(provided).trim() === configured)
}

function defaultRoutine() {
  return { events: [] }
}

function defaultTasks() {
  return { tasks: [] }
}

function safeFilename(key) {
  return String(key).replace(/[^a-z0-9._-]+/gi, '_')
}

function fileStoreBaseDir() {
  const custom = process.env.LOCAL_GLOBAL_DATA_DIR
  if (custom) return custom
  if (process.env.VERCEL) return path.join('/tmp', 'student-dashboard')
  return path.join(process.cwd(), '.local-data')
}

async function getFileJson(key) {
  const dir = fileStoreBaseDir()
  const file = path.join(dir, `${safeFilename(key)}.json`)
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function setFileJson(key, value) {
  const dir = fileStoreBaseDir()
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${safeFilename(key)}.json`)
  await fs.writeFile(file, JSON.stringify(value ?? null, null, 2), 'utf8')
}

function createFileStore(kind) {
  return {
    async get(key) {
      return getFileJson(key)
    },
    async set(key, value) {
      await setFileJson(key, value)
    },
    kind,
  }
}

function createUpstashStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const { Redis } = require('@upstash/redis')
  const redis = new Redis({ url, token })

  return {
    async get(key) {
      const v = await redis.get(key)
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return v
        }
      }
      return v == null ? null : v
    },
    async set(key, value) {
      if (value && typeof value === 'object') await redis.set(key, JSON.stringify(value))
      else await redis.set(key, value)
    },
    kind: 'upstash',
  }
}

async function getStore() {
  const upstash = createUpstashStore()
  if (upstash) return upstash
  return createFileStore(process.env.VERCEL ? 'file-tmp' : 'file-local')
}

const KEY_ROUTINE = 'global.routine.v1'
const KEY_TASKS = 'global.tasks.v1'

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
    const method = req.method || 'GET'
    const store = await getStore()
    const adminPasswordConfigured = Boolean(getConfiguredAdminPassword())

    if (method === 'GET') {
      const routine = (await store.get(KEY_ROUTINE)) || defaultRoutine()
      const tasks = (await store.get(KEY_TASKS)) || defaultTasks()
      return json(res, {
        ok: true,
        routine,
        tasks,
        storageConfigured: true,
        store: store.kind,
        authRequired: adminPasswordConfigured,
        adminOk: adminPasswordConfigured ? isAdminAuthorized(req) : true,
      })
    }

    if (method === 'PUT') {
      if (!isAdminAuthorized(req)) {
        return json(
          res,
          {
            ok: false,
            error:
              'Não autorizado. Envie o header x-admin-password (e configure ADMIN_PASSWORD no deploy).',
          },
          401,
        )
      }

      const body = readBody(req)
      const { routine, tasks } = body || {}

      if (routine) await store.set(KEY_ROUTINE, routine)
      if (tasks) await store.set(KEY_TASKS, tasks)

      const nextRoutine = (await store.get(KEY_ROUTINE)) || defaultRoutine()
      const nextTasks = (await store.get(KEY_TASKS)) || defaultTasks()
      return json(res, {
        ok: true,
        routine: nextRoutine,
        tasks: nextTasks,
        storageConfigured: true,
        store: store.kind,
        authRequired: adminPasswordConfigured,
        adminOk: adminPasswordConfigured ? isAdminAuthorized(req) : true,
      })
    }

    // no auth endpoint needed anymore
    return json(res, { ok: false, error: 'Método não suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
