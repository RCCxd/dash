const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')

function json(res, body, statusCode = 200, extraHeaders = {}) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex')
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
      if (value && typeof value === 'object') {
        await redis.set(key, JSON.stringify(value))
      } else {
        await redis.set(key, value)
      }
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
const KEY_ADMIN_HASH = 'admin.passwordHash.v1'

async function getStoredAdminHash(store) {
  const v = await store.get(KEY_ADMIN_HASH)
  return typeof v === 'string' && v.length >= 16 ? v : null
}

async function requireAdmin(req, store) {
  const requiredEnv = envAdminPassword()
  const got = adminPasswordFromHeaders(req.headers)

  if (requiredEnv) {
    if (!got || got !== requiredEnv) return { ok: false, error: 'Senha de admin inválida.' }
    return { ok: true, source: 'env' }
  }

  const storedHash = await getStoredAdminHash(store)
  if (!storedHash) return { ok: false, code: 'ADMIN_NOT_CONFIGURED', error: 'Admin não configurado.' }

  if (!got) return { ok: false, error: 'Senha de admin inválida.' }
  const gotHash = sha256(`v1:${got}`)
  if (gotHash !== storedHash) return { ok: false, error: 'Senha de admin inválida.' }
  return { ok: true, source: 'store' }
}

async function setupAdminPassword({ store, password }) {
  const requiredEnv = envAdminPassword()
  if (requiredEnv) return { ok: false, error: 'Admin está configurado via ambiente.' }

  const existing = await getStoredAdminHash(store)
  if (existing) return { ok: false, error: 'Admin já está configurado.' }

  const p = String(password || '').trim()
  if (p.length < 4) return { ok: false, error: 'Senha muito curta (mínimo 4 caracteres).' }

  await store.set(KEY_ADMIN_HASH, sha256(`v1:${p}`))
  return { ok: true }
}

async function changeAdminPassword({ req, store, newPassword }) {
  const requiredEnv = envAdminPassword()
  if (requiredEnv) return { ok: false, error: 'Admin está configurado via ambiente.' }

  const admin = await requireAdmin(req, store)
  if (!admin.ok) return admin

  const p = String(newPassword || '').trim()
  if (p.length < 4) return { ok: false, error: 'Senha muito curta (mínimo 4 caracteres).' }

  await store.set(KEY_ADMIN_HASH, sha256(`v1:${p}`))
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
    const store = await getStore()
    if (!store) {
      return json(
        res,
        {
          ok: false,
          error:
            'Storage global não configurado. Em produção no Vercel, conecte um Vercel KV (ou defina um storage) para salvar tarefas/rotina globais.',
        },
        500,
      )
    }

    const method = req.method || 'GET'
    const configured = Boolean(envAdminPassword() || (await getStoredAdminHash(store)))

    if (method === 'GET') {
      const routine = (await store.get(KEY_ROUTINE)) || defaultRoutine()
      const tasks = (await store.get(KEY_TASKS)) || defaultTasks()
      return json(res, { ok: true, routine, tasks, adminConfigured: configured, store: store.kind })
    }

    if (method === 'POST') {
      const body = readBody(req)
      const action = String(body?.action || '').toLowerCase()

      if (action === 'setup') {
        const setup = await setupAdminPassword({ store, password: body?.password })
        if (!setup.ok) return json(res, { ok: false, error: setup.error }, 400)
        return json(res, { ok: true, adminConfigured: true })
      }

      if (action === 'change') {
        const changed = await changeAdminPassword({ req, store, newPassword: body?.newPassword })
        if (!changed.ok)
          return json(res, { ok: false, error: changed.error, code: changed.code }, 401)
        return json(res, { ok: true, adminConfigured: true })
      }

      const admin = await requireAdmin(req, store)
      if (!admin.ok)
        return json(
          res,
          { ok: false, error: admin.error, code: admin.code },
          admin.code ? 428 : 401,
        )
      return json(res, { ok: true, admin: true, source: admin.source })
    }

    if (method === 'PUT') {
      const admin = await requireAdmin(req, store)
      if (!admin.ok)
        return json(
          res,
          { ok: false, error: admin.error, code: admin.code },
          admin.code ? 428 : 401,
        )

      const body = readBody(req)
      const { routine, tasks } = body || {}

      if (routine) await store.set(KEY_ROUTINE, routine)
      if (tasks) await store.set(KEY_TASKS, tasks)

      const nextRoutine = (await store.get(KEY_ROUTINE)) || defaultRoutine()
      const nextTasks = (await store.get(KEY_TASKS)) || defaultTasks()
      return json(res, { ok: true, routine: nextRoutine, tasks: nextTasks, adminConfigured: true })
    }

    return json(res, { ok: false, error: 'Método não suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
