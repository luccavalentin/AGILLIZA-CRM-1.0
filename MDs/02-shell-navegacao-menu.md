# Etapa 02 — Shell da Aplicação: Layout, Menu, Topbar, Notificações

> Requer Etapa 01. Cole as Convenções Globais.
>
> **Antes de começar esta etapa, confirme que a Etapa 01 já entregou as 4 rotas públicas: `/` (landing com 3 cards), `/auth`, `/portal` e `/parceiro`.** Se qualquer uma delas estiver faltando, **volte para a Etapa 01 e complete** — esta etapa só cuida do shell interno autenticado (`_authenticated/*`) e dos shells próprios de `/cliente/*` e `/parceiro/*` **depois do login**, não das telas de login em si.

## Dependências e Produtos

**Depende de:** 00, 00b, **01** (papéis, `has_role`, `correspondente_id`, sessão autenticada).
**Produz (consumido por 03–10):**

- Layout raiz `_authenticated` (sidebar/topbar/breadcrumbs) — todas as rotas internas das próximas etapas montam dentro deste `Outlet`.
- Componente de menu filtrado por `has_role` — Etapas 03–10 apenas registram entradas no menu.
- Tabela `notificacoes` + hook de contagem no topbar — consumido por Etapa 04 (retorno do banco), 05 (mudança de status), 06 (comissão), 07 (SLA), 10 (auditoria).
- Padrões de toast, modal de confirmação e página vazia — reutilizados nas telas seguintes.

## Assets desta etapa (pasta `Logos e a API/`)

- **Logo da sidebar (versão full e versão colapsada/rail)** e **splash**: escolher variações apropriadas em `Logos e a API/Logo PNG/` (a versão horizontal para sidebar aberta e o símbolo/ícone para sidebar colapsada e favicon). Importar de `src/assets/brand/`. **Não** desenhar substitutos com CSS/emoji/texto.

## Objetivo

Construir a “casca” visual comum a todas as telas internas: sidebar colapsável, topbar com notificações e conta, drawer mobile, breadcrumbs. O menu é **filtrado pela matriz de permissões** em tempo real — item não permitido não aparece.

## O que o módulo faz

1. Renderiza layout com sidebar esquerda (desktop full 256px, colapsada 56px), topbar 64px, área principal com `<Outlet />`.
2. No mobile (<1024px), sidebar vira `Sheet` que abre/fecha por botão hambúrguer na topbar.
3. Persiste estado colapsado em `localStorage` (guardado com `typeof window`).
4. Lê `context.permissions` do `beforeLoad` do `_authenticated` e passa por `filterNavByPermissions(nav, perms)` antes de renderizar.
5. Topbar exibe: busca global (ctrl+K), badge de notificações não lidas (realtime), menu da conta (perfil, segurança, sair).
6. Portais separados (`/cliente/*` e `/parceiro/*`) têm shells próprios, cada um com seu `nav-config`.

## Telas / Componentes

### `AppShell` (`src/components/app-shell/app-shell.tsx`)

Props: `nav: NavGroup[]`, `user`, `notificationsSlot?`, `showAccountMenu?`, `signOutRedirect?`, `onSignOut?`, `children`.
Estado: `mobileOpen`, `desktopCollapsed`.

### `SidebarNav` (full)

Lista `NavGroup` (Visão Geral, CRM, Operacional, Documentos, Financeiro, Relatórios, Administração, Conta).
Cada `NavItem`:

- `label`, `icon` (Lucide), `to?` ou `children?`, `hash?`, `badge?`, `perm: { modulo, submenu? }`.
- Item ativo tem barra lateral colorida e ring.
- Item com `children` usa `Collapsible` do shadcn (aberto se algum filho ativo).

### `SidebarRail` (colapsado)

Só ícones + `Tooltip` no hover. Mesmo `NavGroup[]`, achatado.

### `Topbar`

- Botão hambúrguer (mobile) e botão colapsar (desktop).
- Search global: `Command` do shadcn, dispara `useServerFn(globalSearch)` (busca em clientes, simulações, propostas, tarefas).
- Sino de notificações: badge com count. Ao abrir, popover lista últimas 10 de `notificacoes` do usuário; “Ver todas” → `/admin/notificacoes`.
- Avatar + menu: nome, e-mail, links `Meu perfil` / `Segurança` / `Notificações` / `Sair`.

## Estrutura de dados relevante

- `nav-config.ts` (código, não DB): tipagem `NavGroup { id, label, items: NavItem[] }`.
- Cada `NavItem` mapeia para um par `(modulo, acao='view')` da matriz. Se `usuario_tem_permissao(uid, modulo, 'view') = false`, o item é omitido.

## `filterNavByPermissions`

```
function filterNavByPermissions(nav: NavGroup[], perms: Set<string>): NavGroup[]
```

- Uma permissão-chave do formato `"crm.clientes:view"` está no `Set`.
- Item sem `perm` é sempre exibido (ex.: “Visão Geral”).
- Item com `children`: filtra `children` primeiro; se sobrar zero, remove o pai.
- Grupo sem itens após filtragem é omitido.

## Notificações (base — módulo dedicado na Etapa 06)

- `notificacoes(user_id, tipo, titulo, corpo, link, lida BOOL, created_at)`.
- Subscription realtime no topbar: `supabase.channel('notif:'+userId).on('postgres_changes',...)` **dentro** de `useEffect` com cleanup.
- Ao clicar, marca `lida=true` e navega para `link`.

## Permissões-chave usadas aqui

`shell.busca_global:view`, `shell.notificacoes:view`, `conta.perfil:view`, `conta.seguranca:view`.

## Regras de UI

- Design tokens semânticos em `src/styles.css` (`--sidebar`, `--alert`, `--surface` etc.). Nunca hardcode de cor.
- Foco visível (`focus-visible:ring-2`) em todos os interativos.
- Skip link “Pular para conteúdo” no topo (a11y).

## Regras técnicas

- Estado do menu (`desktopCollapsed`) NÃO renderiza no SSR — usar `useEffect` para hidratar.
- Rota `_authenticated` obrigatoriamente renderiza `<AppShell nav={filteredNav}>{<Outlet />}</AppShell>`.
- Portal cliente/parceiro NÃO usa `SidebarNav` interna — tem componente próprio.

## Definition of Done

- Sidebar filtra em tempo real ao mudar matriz (invalidação de query no salvar do admin).
- Mobile drawer fecha ao navegar.
- Nenhum flash de item não permitido (evitar renderizar antes das perms carregarem — Suspense boundary).
- Testes E2E: usuário `analista` sem permissão `financeiro:view` NÃO vê o item; ao acessar URL direta, `beforeLoad` da rota retorna 403.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Sidebar**
  - Light: fundo `bg-sidebar` (branco), borda direita `border-sidebar-border`, texto `text-sidebar-foreground`. Item ativo: `bg-sidebar-accent text-sidebar-accent-foreground` + barra vertical de 3px `bg-primary`. Item hover: `bg-accent`.
  - Dark: fundo com gradiente `bg-sidebar` (`#000A70 → #00052E`), texto `text-sidebar-foreground` (azul-névoa `#EEF0FF`). Item ativo: `bg-sidebar-accent text-white`. Item hover: `bg-white/5`. Ícone de item ativo em `text-white`; inativo em `text-sidebar-foreground/70`.
- **Topbar**: `bg-background border-b border-border` nos dois modos. Título em `text-foreground`, subtítulo em `text-muted-foreground`.
- **Sino de notificações**: ícone `text-muted-foreground`; badge de contagem `bg-destructive text-destructive-foreground` (fica igual nos dois modos — vermelho de alerta).
- **Search global (⌘K)**: overlay `bg-popover text-popover-foreground border border-border`; item destacado `bg-accent text-accent-foreground`.
- **Toggle de tema** (sol/lua): botão `variant="ghost"` no topbar; mostra `Sun` em dark e `Moon` em light. Ao clicar, chama `setTheme(next)` de `src/lib/theme.ts`.
- **Skeleton do menu enquanto carrega permissões**: `bg-muted animate-pulse rounded-md` de mesma altura do item real (evita salto de layout ao aplicar `filterNavByPermissions`).
