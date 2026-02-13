const fs = require('fs/promises')
const path = require('path')

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

async function delFileJson(key) {
  const dir = fileStoreBaseDir()
  const file = path.join(dir, `${safeFilename(key)}.json`)
  try {
    await fs.unlink(file)
  } catch {
    // ignore
  }
}

function createFileStore(kind) {
  return {
    async get(key) {
      return getFileJson(key)
    },
    async set(key, value) {
      await setFileJson(key, value)
    },
    async del(key) {
      await delFileJson(key)
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
    async del(key) {
      await redis.del(key)
    },
    kind: 'upstash',
  }
}

async function getStore() {
  const upstash = createUpstashStore()
  if (upstash) return upstash
  return createFileStore(process.env.VERCEL ? 'file-tmp' : 'file-local')
}

module.exports = {
  getStore,
}

