const { getStore } = require('./_lib/store')
const {
  applySessionCookies,
  ensureAuthenticatedAccess,
  getAccessState,
  isAccessControlEnabled,
  loginWithCredentials,
  logout,
  readBody,
} = require('./_lib/access-control')

function json(res, body, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

module.exports = async (req, res) => {
  try {
    const method = req.method || 'GET'
    const store = await getStore()

    if (method === 'GET') {
      const state = await getAccessState(req, store)
      if (state.authenticated && state.session) {
        applySessionCookies(res, state.session)
      }
      return json(res, {
        ok: true,
        authEnabled: Boolean(state.enabled),
        authenticated: Boolean(state.authenticated),
        account: state.account,
        reason: state.reason,
      })
    }

    if (method === 'POST') {
      if (!isAccessControlEnabled()) {
        const state = await getAccessState(req, store)
        return json(res, {
          ok: true,
          authEnabled: false,
          authenticated: true,
          account: state.account,
          reason: 'DISABLED',
        })
      }

      const body = readBody(req)
      const login = await loginWithCredentials(req, res, store, body)
      if (!login.ok) {
        const invalid = login.reason === 'INVALID_CREDENTIALS'
        const expired = login.reason === 'SUBSCRIPTION_EXPIRED'
        const inactive = login.reason === 'ACCOUNT_INACTIVE'
        const used = login.reason === 'PASSWORD_ALREADY_USED'
        const message = invalid
          ? 'Credenciais invalidas.'
          : expired
            ? 'Assinatura expirada.'
            : inactive
              ? 'Conta inativa.'
              : used
                ? 'Senha de uso unico ja utilizada. Contate o suporte para gerar nova senha.'
                : 'Falha ao autenticar.'
        return json(res, { ok: false, error: message, reason: login.reason }, 401)
      }

      return json(res, {
        ok: true,
        authEnabled: true,
        authenticated: true,
        account: login.account,
        reason: 'OK',
      })
    }

    if (method === 'DELETE') {
      await logout(req, res, store)
      return json(res, { ok: true, authEnabled: isAccessControlEnabled(), authenticated: false })
    }

    if (method === 'HEAD') {
      const guard = await ensureAuthenticatedAccess(req, store)
      if (!guard.ok) return json(res, { ok: false, error: guard.error }, guard.statusCode)
      return json(res, { ok: true }, 200)
    }

    return json(res, { ok: false, error: 'Metodo nao suportado.' }, 405)
  } catch (err) {
    return json(res, { ok: false, error: err?.message || String(err) }, 500)
  }
}
