const fs = require('fs/promises')
const path = require('path')

function json(res, body, statusCode = 200, extraHeaders = {}) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

function adminPasswordFromHeaders(headers) {
  const h = headers || {}
  return (
    h['x-admin-password'] ||
    h['x-admin-token'] ||
    h['X-Admin-Password'] ||
    h['X-Admin-Token'] ||
    ''
  )
}

function envAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || ''
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

function createFileStore() {
  return {
    async get(key) {
      return getFileJson(key)
    },
    async set(key, value) {
      await setFileJson(key, value)
    },
    kind: 'file',
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

function isVercelProd() {
  if (!process.env.VERCEL) return false
  const env = String(process.env.VERCEL_ENV || '').toLowerCase()
  return env && env !== 'development'
}

async function getStore() {
  const upstash = createUpstashStore()
  if (upstash) return upstash
  if (isVercelProd()) return null
  return createFileStore()
}

const KEY_ROUTINE = 'global.routine.v1'
const KEY_TASKS = 'global.tasks.v1'

function requireAdmin(req) {
  const required = envAdminPassword()
  if (!required) {
    return { ok: false, code: 'ADMIN_ENV_NOT_CONFIGURED', error: 'ADMIN_PASSWORD não configurado.' }
  }
  const got = adminPasswordFromHeaders(req.headers)
  if (!got || got !== required) return { ok: false, error: 'Senha de admin inválida.' }
  return { ok: true }
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
    const method = req.method || 'GET'
    const store = await getStore()
    const adminConfigured = Boolean(envAdminPassword())
    const storageConfigured = Boolean(store)

    if (method === 'GET') {
      const routine = (store && (await store.get(KEY_ROUTINE))) || defaultRoutine()
      const tasks = (store && (await store.get(KEY_TASKS))) || defaultTasks()
      return json(res, {
        ok: true,
        routine,
        tasks,
        adminConfigured,
        storageConfigured,
        store: store?.kind || 'none',
      })
    }

    if (method === 'POST') {
      const admin = requireAdmin(req)
      if (!admin.ok) return json(res, { ok: false, error: admin.error, code: admin.code }, 401)
      return json(res, { ok: true, admin: true })
    }

    if (method === 'PUT') {
      const admin = requireAdmin(req)
      if (!admin.ok) return json(res, { ok: false, error: admin.error, code: admin.code }, 401)

      if (!store) {
        return json(
          res,
          {
            ok: false,
            code: 'STORAGE_NOT_CONFIGURED',
            error:
              'Storage global não configurado. Conecte um Redis (Upstash) no Vercel e defina UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.',
          },
          500,
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
        adminConfigured,
        storageConfigured: true,
        store: store.kind,
      })
    }

    return json(res, { ok: false, error: 'Método não suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
