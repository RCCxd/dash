# Dashboard do Estudante (Organização Escolar)

Aplicação Web (SPA) para substituir planilhas: **tarefas** e **rotina semanal**.

## Stack

- React + Vite
- Tailwind CSS (UI responsiva + temas)
- Lucide-React (ícones)
- Persistência por usuário: React Context + `localStorage`
- Backend (API): Vercel Functions (`/api/*`)
- Persistência global (tarefas/rotina): Redis (Upstash via Vercel Marketplace)

## Funcionalidades

- **Dashboard & Tarefas**: tarefas globais (criadas pelo admin) + filtros + cada usuário marca como concluída no próprio dispositivo.
- **Rotina**: grade semanal + chat com IA que gera um plano estruturado e, ao salvar, preenche sua grade (seus itens são editáveis).
- **Configurações**: tema (Marista/Claro/Escuro/Personalizado com HEX), fonte, contraste e outras opções.
- **Admin (no site)**: desbloqueio local por senha (qualquer senha) em **Configurações** para adicionar tarefas globais e exportar JSON automaticamente.

## Rodar localmente

```bash
npm install
npm run dev
```

Observação: `npm run dev` roda apenas o frontend. Para usar **IA** e **dados globais** localmente:

- Instale o Vercel CLI e rode `vercel dev`.

## Build

```bash
npm run build
npm run preview
```

## Deploy no Vercel

- **Build command**: `npm run build`
- **Output directory**: `dist`
- SPA routing e `/api/*` configurados em `vercel.json`.

Se o build falhar com exit `126`, faça redeploy com **Clear build cache** (ou deixe o `prebuild` corrigir permissões de executáveis em `node_modules`).

### Variáveis de ambiente (Vercel)

- `OPENAI_API_KEY` (opcional): habilita a IA no endpoint `/api/routine-ai`.
- `OPENAI_MODEL` (opcional): default `gpt-4o-mini`.

### Storage global (recomendado)

Conecte um Redis do marketplace (Upstash) para persistir tarefas/rotina globais (para todos). O backend usa estas env vars:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Sem isso, o backend usa um fallback simples em arquivo (no Vercel é em `/tmp`), que pode resetar em cold starts.

### OpenAI key sem env (modo local por dispositivo)

Você pode definir uma **OpenAI API Key local** (por dispositivo) em **Configurações → IA**.
Essa chave fica no `localStorage` e é enviada no header `x-openai-key` para `/api/routine-ai`.

## Dados (localStorage)

- Usuário (tarefas): `studentDashboard.taskStatusById.v1`
- Usuário (rotina): `studentDashboard.userRoutine.v1`
- Configurações: `studentDashboard.settings.v1`
- Senha admin (neste dispositivo): `studentDashboard.adminPassword.v1`
