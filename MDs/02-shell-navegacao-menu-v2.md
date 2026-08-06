# Etapa 02 — Shell 2.0: Layout, Menu, Topbar, Tema, Notificações

> Requer Etapa 01. Cole `00-v2` + `00b-v2` antes.

## 1. Objetivo

Casca visual comum a todo o portal interno e ao portal do parceiro (mesmo shell, nav filtrada). Composto por:
- Sidebar esquerda (256px expandida / 56px colapsada).
- Topbar (64px) com busca global, sino de notificações, toggle de tema, menu da conta.
- Área principal com `<Outlet />`.
- Drawer mobile (`Sheet`) em `<lg`.

O App do Cliente tem shell próprio (mobile-first, ver Etapa 09).

## 2. Componente `AppShell` (`src/components/app-shell/app-shell.tsx`)

Props principais:
- `nav: NavGroup[]` — vem de `nav-config.ts`, filtrada por `filterNavByPermissions(nav, permsSet)`.
- `user` — `{ nome, email, foto_url, acesso_tipo, correspondente_id }`.
- `notificationsSlot` — Popover do sino.
- `onSignOut` — chama `supabase.auth.signOut()` + `queryClient.clear()` + `navigate('/auth', { replace: true })`.

Estado local:
- `mobileOpen` (Sheet)
- `desktopCollapsed` (persiste em `localStorage['agilliza-sidebar-collapsed']` via `useEffect` — nunca em SSR)

## 3. `nav-config.ts` (estado atual, 2.0)

Tipagem:
```ts
type NavItem = { label: string; icon: LucideIcon; to?: Route; hash?: string; children?: NavItem[]; badge?: string | number; perm: { modulo: string; acao?: string } | null };
type NavGroup = { id: string; label: string; items: NavItem[] };
```

**Grupos ativos** (ordem):
1. **Visão Geral** — `/dashboard`, `/visao-geral/painel`.
2. **CRM** — Clientes, Chat, Painel, Documentos gerais, Parceiros, Scan IA.
3. **Operacional** — Simulações (Lista/Nova/Completa), Propostas (Lista/Nova/Kanban), Tarefas (Lista/Kanban/Calendário), Demandas (Lista/Kanban), **Central de Chats**.
4. **Documentos** — `/documentos`, `/formularios`, `/matriculas`, `/links`.
5. **Financeiro** — Painel, Contas a Pagar, Contas a Receber, Comissões (banco→correspondente), Repasses/Comissões por Usuário, Fluxo de Caixa, Configurações.
6. **RH** — Ficha (Dashboard), Funcionários (lista+novo), Prévia da Folha, Holerites, Alterações Salariais, Adiantamentos, Descontos, Benefícios, Férias, Faltas/Ocorrências, Atestados, Documentos (interno), Configurações, Relatórios.
7. **Relatórios** — 18 recortes (Painel Geral, Comerciais, Simulações, Propostas, CRM, Clientes, Demandas, Tarefas, Financeiros, Comissões, App Cliente, Operacional, Consolidado, Gerencial, Personalizados, Exportações, RH, Matrículas).
8. **Administração** — Pessoas, Bancos, APIs IA, Integrações, Parâmetros, Auditoria, Backup, Diversos (compras), Notificações & Regras.
9. **Conta** — Perfil, Segurança, Notificações & Sons.

## 4. `filterNavByPermissions(nav, perms)`

- `perms` é um `Set<string>` com chaves `"modulo.submodulo:acao"` provenientes de `context.permissions` (setado em `beforeLoad` do `_authenticated`).
- Item sem `perm` sempre exibido (ex.: "Visão Geral" para todos autenticados).
- Item com `children` filtra os filhos; se sobrar 0, remove o pai.
- Grupo sem items é omitido.
- **Portal do Parceiro** usa o mesmo `nav-config` — o toggle `acesso_tipo='portal_parceiro'` gera automaticamente um `perms` restrito (só CRM/Simulações/Propostas próprias, Comissões próprias, Documentos, Chat).

## 5. Topbar

Elementos:
- **Hambúrguer** (mobile), **botão colapsar** (desktop).
- **Search global (⌘K)** — `Command` do shadcn + `useServerFn(globalSearch)` — busca em clientes, simulações, propostas, tarefas, demandas, funcionários. Debounced 250ms via `useDebouncedValue`.
- **Sino de notificações** — badge de count. Popover mostra 10 últimas de `notificacoes` do usuário; item não lido em `bg-accent` + ponto azul; "Ver todas" → `/conta/notificacoes`.
- **Toggle de tema** (Sun/Moon) chamando `setTheme` de `src/lib/theme.ts`.
- **Avatar + menu**: nome, e-mail, `Meu perfil`, `Segurança`, `Notificações`, **Trocar tema**, **Sair**.

## 6. Notificações em tempo real

- Subscription no topbar dentro de `useEffect`:
  ```ts
  const ch = supabase.channel(`notif:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${userId}` }, ...)
    .subscribe();
  return () => supabase.removeChannel(ch);
  ```
- Debounce de rajadas via `src/lib/realtime-debounce.ts` (coalesce por 200ms).
- Ao inserir: incrementa badge, invalida query da lista, toca som opcional (`src/lib/chat-sound.ts`) se preferência do usuário permitir e evento for do canal de chat.
- Ao clicar em item: `PATCH notificacoes SET lida=true` + navega para `link`.

## 7. Chat piscando (2.0)

Quando o operador tem chat minimizado (CRM chat, chat do cliente, chat de demanda, Central de Chats) e chega mensagem:
- Componente `FloatingChatHost` (`src/components/shared/`) mantém badge de count por chat.
- Ícone/aba minimizada recebe classe `chat-blink` (keyframes em `styles.css`, alterna `text-primary ↔ text-destructive` a cada 800ms).
- Som toca via `useIncomingChatSound` respeitando toggle em `/conta/perfil`.

## 8. Painéis de monitoramento

Todo `/*/painel` (Visão Geral, CRM, Operacional, Financeiro, RH) segue **1 painel = 1 foco**:
- Máximo 4 KPIs hero + 6 mini + 1 gráfico principal + 1 lista/ranking + alertas.
- Componentes canônicos em `src/components/common/dashboard.tsx` (`PanelHeader`, `PanelToolbar`, `HeroMetric`, `MiniMetric`, `PanelCard`, `MetricList`, `AlertRow`, `SectionTitle`).
- Realtime com invalidação estreita da queryKey.
- `staleTime` 30s para KPIs.
- Empty state real com `<CheckCircle2 />` — nunca linhas falsas.

## 9. Rotas do shell

`src/routes/_authenticated/route.tsx` é **integração-managed** (Supabase). Regras:
- `ssr: false` (o session vive em localStorage no browser).
- `beforeLoad` chama `supabase.auth.getUser()` e redireciona para `/auth` se sem sessão.
- Não recriar layout, não adicionar segundo gate. Middleware bearer já registrado em `src/start.ts`.

O `AppShell` é renderizado dentro do componente do layout, envolvendo `<Outlet />`.

## 10. Rotas do parceiro (unificadas)

- `/parceiro` — login público (Etapa 01).
- `/parceiro-inicio` — dashboard reduzido dentro do shell interno (após login, com toggle `acesso_tipo='portal_parceiro'`).
- `/parceiro/clientes|simulacoes|propostas|comissoes|documentos` — **redirects** para as rotas internas correspondentes com escopo "próprios" aplicado.

## 11. Definition of Done

- Sidebar filtra em tempo real (mudar matriz → refletir no menu do usuário afetado).
- Mobile drawer fecha ao navegar.
- Sem flash de item não permitido (`Suspense boundary` no shell até `permissions` carregar).
- `desktopCollapsed` persiste sem crashar SSR.
- Sino: badge atualiza em <1s em outro tab (realtime).
- Toggle de tema aplica sem flicker.
- `parceiro` logado vê nav reduzida e nunca acessa `/admin/*` (403 no `beforeLoad` da rota).
- Central de Chats acessível em `/operacional/chats` no menu Operacional.
- Testes E2E: analista sem `financeiro:view` → sem item no menu + 403 ao acessar URL direta.
