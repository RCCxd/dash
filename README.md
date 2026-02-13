# Dashboard do Estudante (Organizacao Escolar)

Aplicacao Web (SPA) para substituir planilhas: **tarefas** e **rotina semanal**.

## Stack

- React + Vite
- Tailwind CSS
- Lucide-React
- Persistencia por usuario: React Context + `localStorage`
- Tarefas globais (todos): `public/tarefas-globais.json` e/ou `/api/global-data`
- API serverless (`/api/*`) com opcao de autenticacao por assinatura

## Funcionalidades

- **Dashboard & Tarefas**: tarefas globais + tarefas pessoais + filtros.
- **Rotina**: grade semanal manual por usuario.
- **Configuracoes**: tema, fonte, contraste e preferencias.
- **Admin**: gestao de tarefas globais liberada apenas para o `username` permitido.
- **Acesso por assinatura**: login obrigatorio no dashboard com sessao por cookie HTTP-only.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy no Vercel

- Build command: `npm run build`
- Output directory: `dist`
- SPA routing e `/api/*` ja configurados em `vercel.json`.

## Assinatura mensal (controle de acesso)

### Como funciona

- O frontend bloqueia o app ate autenticar em `/api/access`.
- A API cria sessao em cookie HTTP-only.
- Cada conta permite **1 sessao ativa por vez**.
- Se a mesma conta logar em outro dispositivo, a sessao anterior e invalidada.

### Variaveis de ambiente

Use `SUBSCRIPTIONS_JSON` para cadastrar assinantes:

```json
[
  {
    "id": "cliente-001",
    "name": "Cliente 1",
    "username": "cliente1",
    "password": "senha-forte",
    "expiresAt": "2026-03-12T23:59:59.000Z",
    "active": true,
    "singleUsePassword": false
  }
]
```

Opcionalmente, voce pode usar `passwordHash` (sha256 de `ACCESS_PASSWORD_PEPPER:senha`) no lugar de `password`.

Variaveis suportadas:

- `ACCESS_CONTROL_ENABLED`: `true/false` (se nao definir, ativa automaticamente quando houver assinantes configurados)
- `SUBSCRIPTIONS_JSON`: lista de contas com username/senha e validade
- `ACCESS_PASSWORD_PEPPER`: segredo extra para hash das senhas
- `ACCESS_SESSION_HOURS`: validade da sessao (padrao `24`)
- `ACCESS_BIND_USER_AGENT`: `true/false` para amarrar sessao ao user-agent (padrao `true`)
- `ACCESS_SESSION_COOKIE`: nome do cookie de sessao (padrao `dash_access_session`)
- `ADMIN_ALLOWED_USERNAME`: username com permissao de admin (padrao `RCCxd`)
- `singleUsePassword` (por assinante): se `true`, a senha funciona apenas no primeiro login

Fallback para conta unica:

- `ACCESS_USERNAME` (ou `ACCESS_EMAIL` para retrocompatibilidade)
- `ACCESS_PASSWORD`
- `ACCESS_EXPIRES_AT` (opcional)

## Dados (localStorage)

- Usuario (tarefas): `studentDashboard.taskStatusById.v1`
- Usuario (tarefas pessoais): `studentDashboard.userTasks.v1`
- Usuario (rotina): `studentDashboard.userRoutine.v1`
- Configuracoes: `studentDashboard.settings.v1`

## Observacao importante

Nao existe protecao 100% impossivel de compartilhar na web. O que este projeto implementa e um bloqueio forte de uso compartilhado via sessao unica ativa + expiracao de assinatura no backend.
