const crypto = require('crypto')

const SESSION_COOKIE = process.env.ACCESS_SESSION_COOKIE || 'dash_access_session'
const KEY_SESSION_PREFIX = 'access.session.v1'
const KEY_ACTIVE_SESSION_PREFIX = 'access.active.v1'
const KEY_PASSWORD_USED_PREFIX = 'access.password.used.v1'
const PASSWORD_PEPPER = process.env.ACCESS_PASSWORD_PEPPER || ''

function boolFromEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null || String(raw).trim() === '') return fallback
  const v = String(raw).trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return fallback
}

function getSessionHours() {
  const raw = Number(process.env.ACCESS_SESSION_HOURS)
  if (!Number.isFinite(raw) || raw <= 0) return 24
  return Math.min(raw, 24 * 30)
}

function normalizeUsername(input) {
  return String(input || '').trim().toLowerCase()
}

function isAccessControlEnabled() {
  const explicit = process.env.ACCESS_CONTROL_ENABLED
  if (explicit != null && String(explicit).trim() !== '') {
    return boolFromEnv('ACCESS_CONTROL_ENABLED', false)
  }
  return hasConfiguredSubscribers()
}

function hasConfiguredSubscribers() {
  const fromJson = process.env.SUBSCRIPTIONS_JSON
  if (fromJson && String(fromJson).trim()) return true

  const username = process.env.ACCESS_USERNAME || process.env.ACCESS_EMAIL
  const password = process.env.ACCESS_PASSWORD
  return Boolean(username && password)
}

function readHeader(req, name) {
  const headers = req.headers || {}
  const target = String(name).toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v
  }
  return undefined
}

function cookieMap(req) {
  const raw = readHeader(req, 'cookie')
  if (!raw || typeof raw !== 'string') return {}
  const map = {}
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=')
    if (idx <= 0) return
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    map[key] = decodeURIComponent(value)
  })
  return map
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie')
  if (!prev) {
    res.setHeader('Set-Cookie', cookie)
    return
  }
  if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev, cookie])
    return
  }
  res.setHeader('Set-Cookie', [prev, cookie])
}

function setSessionCookie(res, sessionId, maxAgeSeconds) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''
  appendSetCookie(
    res,
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds || 0))}${secure}`,
  )
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''
  appendSetCookie(res, `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
}

function sessionKey(sessionId) {
  return `${KEY_SESSION_PREFIX}.${sessionId}`
}

function activeSessionKey(accountId) {
  return `${KEY_ACTIVE_SESSION_PREFIX}.${accountId}`
}

function passwordUsedKey(accountId) {
  return `${KEY_PASSWORD_USED_PREFIX}.${accountId}`
}

function toIso(input) {
  if (input == null || input === '') return null
  if (Number.isFinite(Number(input))) {
    const d = new Date(Number(input))
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }
  const d = new Date(String(input))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function hash(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex')
}

function hashPassword(password) {
  return hash(`${PASSWORD_PEPPER}:${String(password || '')}`)
}

function constantTimeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8')
  const bb = Buffer.from(String(b || ''), 'utf8')
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

function normalizeSubscriber(row, index) {
  if (!row || typeof row !== 'object') return null
  const usernameRaw = String(row.username || row.email || '').trim()
  const username = normalizeUsername(usernameRaw)
  if (!username) return null

  const passwordHashRaw = String(row.passwordHash || '').trim().toLowerCase()
  const passwordPlain = String(row.password || '')
  const passwordHash = passwordHashRaw || (passwordPlain ? hashPassword(passwordPlain) : '')
  if (!passwordHash) return null

  const expiresAt = toIso(row.expiresAt)
  const id = String(row.id || '').trim() || `acc_${hash(username).slice(0, 16)}_${index}`
  const active = row.active !== false
  const singleUsePassword = row.singleUsePassword === true

  return {
    id,
    username,
    passwordHash,
    expiresAt,
    active,
    singleUsePassword,
    name: String(row.name || '').trim() || usernameRaw || username,
  }
}

function configuredSubscribers() {
  const fromEnvJson = process.env.SUBSCRIPTIONS_JSON
  if (fromEnvJson && String(fromEnvJson).trim()) {
    try {
      const parsed = JSON.parse(fromEnvJson)
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.subscribers) ? parsed.subscribers : []
      return list.map(normalizeSubscriber).filter(Boolean)
    } catch {
      return []
    }
  }

  const username = process.env.ACCESS_USERNAME || process.env.ACCESS_EMAIL
  const password = process.env.ACCESS_PASSWORD
  if (!username || !password) return []

  const single = normalizeSubscriber(
    {
      id: process.env.ACCESS_ACCOUNT_ID || 'default',
      username,
      password,
      expiresAt: process.env.ACCESS_EXPIRES_AT || null,
      active: true,
      singleUsePassword: boolFromEnv('ACCESS_PASSWORD_SINGLE_USE', false),
    },
    0,
  )
  return single ? [single] : []
}

function publicAccount(account) {
  if (!account) return null
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    expiresAt: account.expiresAt,
    singleUsePassword: Boolean(account.singleUsePassword),
  }
}

function isExpired(isoString) {
  if (!isoString) return false
  const at = new Date(isoString).getTime()
  if (!Number.isFinite(at)) return false
  return Date.now() > at
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

function getClientUserAgent(req) {
  return String(readHeader(req, 'user-agent') || '')
}

async function isPasswordAlreadyUsed(store, account) {
  if (!account?.singleUsePassword) return false
  const mark = await store.get(passwordUsedKey(account.id))
  if (!mark) return false
  if (typeof mark === 'object' && mark.passwordHash) {
    return String(mark.passwordHash) === String(account.passwordHash)
  }
  return true
}

async function consumePassword(store, account) {
  if (!account?.singleUsePassword) return
  await store.set(passwordUsedKey(account.id), {
    usedAt: new Date().toISOString(),
    passwordHash: account.passwordHash,
  })
}

async function findAccountByCredentials(store, usernameInput, passwordInput) {
  const username = normalizeUsername(usernameInput)
  const password = String(passwordInput || '')
  if (!username || !password) return { ok: false, reason: 'INVALID_CREDENTIALS' }

  const subscribers = configuredSubscribers()
  const account = subscribers.find((s) => s.username === username)
  if (!account) return { ok: false, reason: 'INVALID_CREDENTIALS' }
  if (!account.active) return { ok: false, reason: 'ACCOUNT_INACTIVE' }
  if (isExpired(account.expiresAt)) return { ok: false, reason: 'SUBSCRIPTION_EXPIRED' }

  const providedHash = hashPassword(password)
  if (!constantTimeEqual(account.passwordHash, providedHash)) {
    return { ok: false, reason: 'INVALID_CREDENTIALS' }
  }

  if (await isPasswordAlreadyUsed(store, account)) {
    return { ok: false, reason: 'PASSWORD_ALREADY_USED' }
  }

  return { ok: true, account }
}

function maxSessionExpiryIso(accountExpiresAt) {
  const now = Date.now()
  const sessionMs = getSessionHours() * 60 * 60 * 1000
  const sessionEnd = now + sessionMs
  if (!accountExpiresAt) return new Date(sessionEnd).toISOString()

  const accountEnd = new Date(accountExpiresAt).getTime()
  if (!Number.isFinite(accountEnd)) return new Date(sessionEnd).toISOString()
  return new Date(Math.min(accountEnd, sessionEnd)).toISOString()
}

async function createSession(store, account, deviceId, userAgent) {
  const sessionId = crypto.randomBytes(32).toString('hex')
  const now = new Date().toISOString()
  const expiresAt = maxSessionExpiryIso(account.expiresAt)
  const session = {
    id: sessionId,
    accountId: account.id,
    username: account.username,
    deviceId: String(deviceId || '').slice(0, 200),
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgentHash: hash(userAgent || ''),
  }

  await store.set(sessionKey(sessionId), session)
  await store.set(activeSessionKey(account.id), sessionId)
  return session
}

async function invalidateSession(store, sessionId) {
  if (!sessionId) return
  const key = sessionKey(sessionId)
  const session = await store.get(key)
  await store.del(key)
  if (!session || !session.accountId) return

  const activeKey = activeSessionKey(session.accountId)
  const active = await store.get(activeKey)
  if (String(active || '') === String(sessionId)) await store.del(activeKey)
}

async function getSessionFromRequest(req, store) {
  const sid = cookieMap(req)[SESSION_COOKIE]
  if (!sid) return null
  const loaded = await store.get(sessionKey(sid))
  if (!loaded || typeof loaded !== 'object') return null
  return { ...loaded, id: sid }
}

async function accountByIdOrUsername(accountId, username) {
  const subscribers = configuredSubscribers()
  const id = String(accountId || '')
  const usr = normalizeUsername(username)
  return subscribers.find((s) => s.id === id || s.username === usr) || null
}

function shouldBindUserAgent() {
  return boolFromEnv('ACCESS_BIND_USER_AGENT', true)
}

async function validateSession(req, store) {
  const session = await getSessionFromRequest(req, store)
  if (!session) return { ok: false, reason: 'NO_SESSION' }

  if (isExpired(session.expiresAt)) {
    await invalidateSession(store, session.id)
    return { ok: false, reason: 'SESSION_EXPIRED' }
  }

  const account = await accountByIdOrUsername(session.accountId, session.username)
  if (!account || !account.active) {
    await invalidateSession(store, session.id)
    return { ok: false, reason: 'ACCOUNT_INACTIVE' }
  }
  if (isExpired(account.expiresAt)) {
    await invalidateSession(store, session.id)
    return { ok: false, reason: 'SUBSCRIPTION_EXPIRED' }
  }

  const active = await store.get(activeSessionKey(account.id))
  if (String(active || '') !== String(session.id)) {
    return { ok: false, reason: 'SESSION_REPLACED' }
  }

  if (shouldBindUserAgent()) {
    const expected = String(session.userAgentHash || '')
    const actual = hash(getClientUserAgent(req))
    if (expected && expected !== actual) {
      return { ok: false, reason: 'DEVICE_MISMATCH' }
    }
  }

  const nextExpiry = maxSessionExpiryIso(account.expiresAt)
  const nextSession = {
    ...session,
    lastSeenAt: new Date().toISOString(),
    expiresAt: nextExpiry,
  }
  await store.set(sessionKey(session.id), nextSession)
  return { ok: true, session: nextSession, account }
}

async function getAccessState(req, store) {
  const enabled = isAccessControlEnabled()
  if (!enabled) {
    return {
      enabled,
      authenticated: true,
      account: null,
      reason: 'DISABLED',
    }
  }

  const result = await validateSession(req, store)
  if (!result.ok) {
    return {
      enabled,
      authenticated: false,
      account: null,
      reason: result.reason,
    }
  }

  return {
    enabled,
    authenticated: true,
    account: publicAccount(result.account),
    reason: 'OK',
  }
}

async function loginWithCredentials(req, res, store, body) {
  const username = String(body?.username || body?.email || '')
  const password = String(body?.password || '')
  const deviceId = String(body?.deviceId || '')
  const verified = await findAccountByCredentials(store, username, password)
  if (!verified.ok) return { ok: false, reason: verified.reason }

  await consumePassword(store, verified.account)

  const session = await createSession(store, verified.account, deviceId, getClientUserAgent(req))
  const expiryMs = new Date(session.expiresAt).getTime()
  const maxAgeSeconds = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000))
  setSessionCookie(res, session.id, maxAgeSeconds)

  return {
    ok: true,
    account: publicAccount(verified.account),
  }
}

async function logout(req, res, store) {
  const sid = cookieMap(req)[SESSION_COOKIE]
  if (sid) await invalidateSession(store, sid)
  clearSessionCookie(res)
}

async function ensureAuthenticatedAccess(req, store) {
  const state = await getAccessState(req, store)
  if (!state.enabled) return { ok: true, state }
  if (state.authenticated) return { ok: true, state }
  return {
    ok: false,
    statusCode: 401,
    error: 'Acesso restrito. Faca login com assinatura ativa.',
    state,
  }
}

module.exports = {
  isAccessControlEnabled,
  readBody,
  getAccessState,
  loginWithCredentials,
  logout,
  ensureAuthenticatedAccess,
}
