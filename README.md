# Dashboard do Estudante (Organização Escolar)

Aplicação Web (SPA) para substituir planilhas: **tarefas** e **rotina semanal**.

## Stack

- React + Vite
- Tailwind CSS (UI responsiva + temas)
- Lucide-React (ícones)
- Persistência por usuário: React Context + `localStorage`
- Tarefas globais (para todos): arquivo versionado `public/tarefas-globais.json`

## Funcionalidades

- **Dashboard & Tarefas**: tarefas globais (criadas pelo admin) + tarefas pessoais (editáveis) + filtros + cada usuário marca como concluída no próprio dispositivo.
- **Rotina**: grade semanal manual e local (cada pessoa monta a própria rotina no dispositivo).
- **Configurações**: tema (Marista/Claro/Escuro/Personalizado com HEX), fonte, contraste e outras opções.
- **Admin (no site)**: em **Configurações**, defina qualquer senha para liberar o menu **Admin** (neste dispositivo) e gerenciar/importar/exportar tarefas globais.

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

- **Build command**: `npm run build`
- **Output directory**: `dist`
- SPA routing e `/api/*` configurados em `vercel.json`.

Se o build falhar com exit `126`, faça redeploy com **Clear build cache** (ou deixe o `prebuild` corrigir permissões de executáveis em `node_modules`).

## Fluxo de tarefas globais (manual)

1) Abra **Configurações → Admin** e edite as tarefas globais.
2) Clique em **Exportar** (ou deixe o auto-download ativado) para gerar `tarefas-globais.json`.
3) Substitua o arquivo `public/tarefas-globais.json` pelo exportado e dê commit.
4) Faça deploy. A nova versão passa a valer para todos.

## Dados (localStorage)

- Usuário (tarefas): `studentDashboard.taskStatusById.v1`
- Usuário (tarefas pessoais): `studentDashboard.userTasks.v1`
- Usuário (rotina): `studentDashboard.userRoutine.v1`
- Configurações: `studentDashboard.settings.v1`
- Senha admin (neste dispositivo): `studentDashboard.adminPassword.v1`
