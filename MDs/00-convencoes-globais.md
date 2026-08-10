# 00 — Convenções Globais (colar no topo de TODA etapa)

## Produto

Sistema web + PWA para correspondente bancário de financiamento imobiliário e home equity. Integra com a **API do provedor de integração bancária** (agregador que roteia para Bradesco, Santander, Itaú, Caixa, Inter etc.). Usuários internos operam simulações, propostas, contratos, financeiro e comissões. Clientes acompanham o processo em um app próprio (PWA) autenticado por CPF+data de nascimento (PF) ou CNPJ+data de abertura (PJ) — **sem envio de código, sem SMS, sem e-mail, sem WhatsApp**.

## Marca branca / Nomenclatura (regra dura — vale em TODA etapa)

O sistema é **marca branca do correspondente Agilliza**. **NUNCA** exibir ao usuário — em nenhuma tela, texto, tooltip, label, título de página, mensagem de erro, PDF, e-mail, notificação, `<title>`, `meta description`, `alt`, badge, log visível ao usuário ou nome de arquivo baixado — os termos:

- "HomeFin", "Homefin", "home fin" (ou qualquer variação do nome do provedor de integração bancária);
- "Lovable", "lovable.dev", "AI Gateway" ou qualquer marca da plataforma de build;
- nomes de fornecedores de infra (Supabase, Cloudflare, Vercel etc.).

**Uso permitido apenas em contexto interno técnico**, invisível ao usuário final:

- Nomes de tabelas/colunas do Postgres já existentes (`homefin_bancos`, `homefin_id_oportunidade`, `proposta_logs_homefin` etc.) — renomear é caro e não gera valor, ficam como estão.
- Variáveis de ambiente (`HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`).
- Nomes de server functions (`enviarHomeFin`, `reenviarHomeFin` etc.).
- Nomes de pastas em `Logos e a API/APIS/` e nomes internos dos arquivos oficiais da API (não são expostos ao usuário).

**Substituições canônicas na UI e em qualquer texto visível**:
| Onde antes aparecia | Usar na UI |
|---|---|
| "HomeFin" | "Integração Bancária" ou "Provedor de Integração" |
| "API HomeFin" | "Integração Bancária" |
| "Enviar para HomeFin" | "Enviar ao banco" / "Integrar com o banco" |
| "Logs HomeFin" | "Logs de Integração" |
| "Cache HomeFin" | "Cache de Integração" |
| "Sandbox HomeFin" | "Ambiente de homologação da integração" |
| "Callback HomeFin" | "Callback de Integração" |
| "Oportunidade HomeFin" | "Oportunidade" (sem sufixo) |

Antes de finalizar qualquer tela ou PDF, o agente **deve fazer uma varredura final** por `homefin|lovable` (case-insensitive) no que será renderizado ao usuário e substituir por termo neutro. Falha aqui é bloqueio de DoD.

## Assets do projeto (obrigatório usar — NÃO gerar substitutos)

Todos os arquivos oficiais da marca **Agilliza** e a documentação completa da **API de integração bancária** já estão versionados na pasta `Logos e a API/` na raiz do projeto. É **proibido** gerar logos com IA, inventar endpoints, ou "supor" contratos de API — sempre consultar estes arquivos.

- **`Logos e a API/Logo PNG/`** — 20 variações da logo Agilliza em PNG (com transparência). Usar em headers, sidebar, tela de login, splash do PWA, favicon e ícones do manifest. Copiar para `src/assets/brand/` no início do projeto e importar via ES6 (`import logo from '@/assets/brand/agilliza-logo-1.png'`).
- **`Logos e a API/Logo JPG/`** — 16 variações em JPG (fundo sólido). Usar em contextos que não suportam transparência (PDFs gerados, `og:image`).
- **`Logos e a API/Logo Vetor/`** — `AGILLIZA-LOGO.ai`, `.eps`, `.pdf`. Referência para reproduzir a marca em SVG (favicon SVG, ícones do PWA em tamanhos grandes, cabeçalhos de relatórios impressos).
- **`Logos e a API/APIS/`** — documentação **completa e autoritativa** da integração bancária (uso interno, jamais citada em UI):
  - `1 - image001.png` — fluxograma visual resumido.
  - `2 - Documentacao API Homefin.pdf` — manual funcional (regras de negócio, campos obrigatórios por produto, comportamento por banco).
  - `3 - Fluxograma API Homefin.pdf` — diagrama do ciclo simulação → proposta → contrato.
  - `4 - swagger-output 29012026.json` — **contrato OpenAPI oficial** (endpoints, schemas, códigos de retorno). Toda tipagem TypeScript de request/response deve ser derivada deste arquivo (gerar com `openapi-typescript` para `src/integrations/homefin/types.ts`). Nunca escrever tipos "à mão".
  - `5 - API Homefin.postman_collection.json` — coleção Postman para testar manualmente antes de codar.

**Regra dura**: antes de implementar qualquer chamada à integração bancária, o prompt precisa ter lido o swagger (`4 - swagger-output 29012026.json`) e o PDF de documentação. Antes de colocar qualquer marca visual na tela, o prompt precisa apontar para um arquivo específico de `Logos e a API/Logo PNG/` ou `Logo Vetor/`. **Não usar placeholder, não usar texto "Agilliza" estilizado no lugar da logo, não gerar ícones alternativos com IA.**

## Bancos parceiros — padrão de habilitação

A tabela `bancos_parceiros` deve ser **semeada por migration** com os 5 bancos abaixo. O flag `ativo` controla se o banco aparece nos seletores de Simulação e Proposta e se o botão "Enviar ao banco" fica habilitado. A tela `/admin/bancos` permite ligar/desligar cada um sem código.

| Banco     | Código      | `ativo` (default seed) | Observação                                                                               |
| --------- | ----------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Bradesco  | `bradesco`  | **true**               | Ativo desde o dia 1 (Simulação + Proposta)                                               |
| Santander | `santander` | **true**               | Ativo desde o dia 1 (Simulação + Proposta)                                               |
| Itaú      | `itau`      | **true**               | Ativo desde o dia 1 (Simulação + Proposta)                                               |
| Inter     | `inter`     | **false**              | Pré-cadastrado, aguardando homologação — habilitar futuramente em Configurações → Bancos |
| Caixa     | `caixa`     | **false**              | Pré-cadastrado, aguardando homologação — habilitar futuramente em Configurações → Bancos |

- Seletores de banco na UI (multi-select da Simulação, tabela de bancos da Proposta, filtros de relatórios) usam a view `vw_bancos_ativos` (`SELECT * FROM bancos_parceiros WHERE ativo=true ORDER BY ordem, nome`).
- A tela `/admin/bancos` mostra os 5 sempre; bancos com `ativo=false` aparecem em cinza com badge "Aguardando homologação" e toggle para ativar. Ao ativar, exigir preenchimento de: `codigo_agencia_padrao`, `codigo_parceiro`, `credenciais` (secrets do banco) e um checklist "Testes de conectividade OK".
- Default de envio da Simulação (`flag_padrao=true`): Bradesco, Santander, Itaú.

## Stack obrigatória

- TanStack Start v1 (React 19 + Vite 7 + SSR em Cloudflare Workers).
- Roteamento por arquivo em `src/routes/`. `createServerFn` para lógica servidor. `src/routes/api/public/*` só para webhooks.
- Supabase (Postgres + Auth + Storage + Realtime). RLS **sempre ligado** em toda tabela de negócio.
- Tailwind v4 via `src/styles.css`. shadcn/ui como base de componentes.
- TanStack Query no shell do router (loader → `ensureQueryData`, componente → `useSuspenseQuery`).

## Independência de plataforma (obrigatório)

- **Zero dependência de Lovable Cloud, Lovable AI Gateway ou qualquer serviço proprietário da Lovable.** O sistema roda em Cloudflare Workers + Supabase + APIs externas contratadas pelo próprio cliente.
- **Todas as chaves são fornecidas pelo dono do sistema** e cadastradas como secrets no ambiente (`process.env.*`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`, `GEMINI_API_KEY` (ou `OPENAI_API_KEY` — o que o cliente usar), `CLIENTE_APP_SESSION_SECRET`.
- **Chamadas a IA** (Scan IA, sugestões) devem ir **direto** para o endpoint oficial do provedor (Google Gemini `https://generativelanguage.googleapis.com`, OpenAI `https://api.openai.com`, etc.) via `fetch` dentro de `createServerFn`. **Nunca** usar `https://ai.gateway.lovable.dev`, `@lovable/*`, `lovable-ai-*` ou qualquer SDK da Lovable.
- Instalar bibliotecas oficiais quando existir (`@google/generative-ai`, `openai`) ou usar `fetch` direto. Não usar wrappers proprietários.
- Se algum prompt de etapa mencionar "AI Gateway", "Lovable Cloud", "connector Lovable": **ignore** e substitua por chamada direta com chave do cliente.

## Integrações externas — lista fechada

As ÚNICAS integrações externas do projeto são:

1. **Supabase** (Auth, Postgres, Storage, Realtime) — infra própria do cliente.
2. **HomeFin API** (roteia para os bancos) — via `HOMEFIN_*` secrets.
3. **Provedor de IA** escolhido pelo cliente (Gemini OU OpenAI) — para Scan IA e sugestões, chamada direta ao endpoint oficial.

**NÃO existe e não deve ser proposto**: Twilio, Brevo, Resend, SendGrid, Mailgun, WhatsApp Business, Meta Cloud API, SMTP, Web Push, provedor de telefonia, chatbot externo, connector Lovable, Zapier, Make, n8n. Qualquer prompt que peça envio de e-mail, SMS, WhatsApp ou push por parte do sistema está errado — ignore essa parte, mantenha apenas notificação **in-app** (registro em tabela + realtime Supabase para o sino).

## Princípios não negociáveis

1. **Segurança em camadas**: RLS + `SECURITY DEFINER` para agregações + validação server-side em `createServerFn`. Nunca confiar no cliente.
2. **Papéis em tabela separada** (`user_roles`), nunca em `profiles`. Verificar com `has_role(uid, role)`.
3. **Segredos** só no servidor (`process.env.*` dentro do `.handler()`). Nunca no bundle client.
4. **LGPD**: consentimento explícito antes de enviar dado pessoal a qualquer banco. Mascarar CPF/CNPJ/renda em logs (`mask_pii_jsonb`). Auditoria de todo acesso a dado sensível.
5. **Escopo de dados**: toda listagem respeita `usuario_escopo_dados(uid, modulo)` que retorna `'todos' | 'equipe' | 'proprios'`. Nunca `SELECT *` sem escopo.
6. **Idempotência**: toda chamada externa (HomeFin, banco, e-mail) deve ser idempotente por chave de negócio (`numero_simulacao`, `numero_proposta`, `homefin_id_*`).
7. **Auditoria**: toda mudança de status ou envio a banco grava histórico com `usuario_id`, `timestamp`, `payload_anterior`, `payload_novo`.
8. **Mobile-first**: todo formulário testado em 375×667. Radix Select do shadcn precisa do fix de altura do `Viewport` (não usar `h-[var(--radix-select-trigger-height)]`).
9. **SSR-safe**: nenhum acesso a `window`, `localStorage`, `document` em módulo top-level. Sempre guardar `typeof window !== 'undefined'`.
10. **Não reinventar**: usar shadcn, TanStack, Supabase JS. Não escrever roteador próprio, form próprio, tabela própria.
11. **PROIBIDO DADO MOCKADO / FAKE / DUMMY / FIXTURE / HARDCODED em qualquer lugar do sistema.** Regras:
    - Nenhum array literal de "exemplo" dentro de componente (`const clientes = [{ nome: "João" }, ...]`).
    - Nenhum retorno stub em server function (`return { data: MOCK_DATA }`).
    - Nenhum `if (env === 'dev') return fakeResponse()`.
    - Nenhum "Lorem ipsum", "Cliente Teste", "Banco XYZ" em UI, PDF, e-mail ou payload.
    - Nenhuma resposta fake para HomeFin / bancos: a integração ou chama a API real (sandbox ou produção conforme `HOMEFIN_BASE_URL`) ou levanta erro tratado. Nunca inventa `parcelas`, `taxa`, `id_proposta`.
    - Toda tela vazia mostra **empty state real** ("Nenhuma simulação encontrada — crie a primeira") + botão de ação. Nunca preenche com linhas falsas para "parecer cheio".
    - Toda listagem é query real ao Supabase com filtros, escopo e paginação — jamais array em memória.
    - Único dado escrito em migração é **dado de referência de domínio** (níveis de acesso, etapas de pipeline, tipos de documento, bancos suportados). Isso é configuração, não mock. Nunca inserir clientes, simulações, propostas, tarefas ou usuários "de exemplo" em migração.
    - Testes automatizados (Vitest/Playwright) criam seus próprios dados via factory dentro do teste e limpam ao final — nunca dependem de "dados de demonstração" no banco.

## Nomenclatura (fixa, não mudar)

- **Papéis (`app_role`)**: `admin` (suporte da plataforma, não aparece na UI comercial), `correspondente` (dono do ecossistema), `gestor`, `comercial`, `analista`, `imobiliaria`, `corretor`, `cliente`. Detalhe do ecossistema em `01-fundacao-auth-permissoes.md`.
- **Menu principal (raiz)**: Visão Geral, CRM, Operacional, Documentos, Financeiro, Relatórios, Administração.
- **Portais**: interno (`/`), cliente (`/cliente/*`), parceiro (`/parceiro/*`).
- **Prefixos de numeração**: `SIM-######`, `PRO-######`, `DEM-######`, `TAR-######`, `CP-######`, `PC-######`.

## Aparência (obrigatório em TODA etapa que produza UI)

- Este arquivo NÃO define cores. Toda decisão de cor, tom de status, tipografia, raio, sombra, modo claro/escuro e paleta de gráfico está em **`00b-tons-cores-design-tokens.md`** — colar junto deste em toda etapa de UI.
- Regra que vale para todo prompt de tela: **sem cor crua** no `.tsx` (`text-white`, `bg-black`, `bg-[#...]` são proibidos). Sempre `bg-primary`, `text-muted-foreground`, `border-input` etc.
- Sistema tem **modo claro (padrão) e modo escuro completos**; toggle no topbar; a UI precisa ficar legível nos dois modos.

## Responsividade (obrigatória em TODA tela, sem exceção)

Todo componente construído nesse sistema é **responsivo por padrão**. Não existe tela "só desktop" nem "só mobile". Regras que valem para todos os prompts:

- **Mobile-first**: escreva o layout partindo de 375×667 e adicione breakpoints subindo (`sm:`, `md:`, `lg:`, `xl:`). Testar visualmente em 375, 414, 768, 1024, 1280 e 1440.
- **Grid fluido**: cards em `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Tabelas grandes viram cards empilhados abaixo de `md`, ou ganham `overflow-x-auto` com coluna de identificação `sticky left-0`.
- **Sidebar/menu**: fixo em `lg+`, colapsa em drawer (`Sheet` do shadcn) em `< lg`. Topbar tem botão hamburguer visível apenas em `< lg`.
- **Tipografia responsiva**: títulos `text-xl sm:text-2xl lg:text-3xl`. Nunca fonte fixa em pixel para heading.
- **Toque**: alvos clicáveis mínimo 44×44px em mobile (`min-h-11 min-w-11` em botões-ícone). Espaçamento entre ações ≥ 8px.
- **Formulários**: um campo por linha em mobile, duas colunas em `md+`. `Input`, `Select`, `Textarea` sempre `w-full`. Modais viram `Drawer` (bottom sheet) em `< md`.
- **Viewport**: usar `h-dvh` (não `h-screen`) para layouts full-height por causa da barra do navegador mobile.
- **Imagens**: sempre `aspect-*` + `object-cover` no wrapper. Nunca dimensão fixa que quebre em telas estreitas.
- **Padrão de header com widget** (KPI + botão, avatar + nome + ação): `grid grid-cols-[minmax(0,1fr)_auto]` no mobile, promove a `flex` em `sm:`. Texto com `min-w-0 truncate`, ícones/avatars com `shrink-0`.
- **Nada de overflow horizontal**. Se aparece scroll horizontal em qualquer viewport ≥ 320px, é bug.

## PWA (todo portal do sistema)

Todos os três portais (interno `/`, cliente `/cliente/*`, parceiro `/parceiro/*`) são **PWAs instaláveis**.

- **Manifest** por portal: `public/manifest.webmanifest` (interno), `public/manifest-cliente.webmanifest`, `public/manifest-parceiro.webmanifest`. Cada um com `name`, `short_name`, `theme_color` (do design token), `background_color`, `display: "standalone"`, ícones 192/512 (maskable e any), `start_url` e `scope` do portal.
- **Ícones** gerados a partir do logo Agilliza, em `public/icons/`. Apple touch icon + favicons multi-tamanho.
- **Service worker** de app-shell **só onde o usuário pediu offline** — hoje o único portal com modo offline é o **App Cliente** (ver `09-app-cliente-pwa.md`). Portais internos são manifest-only. Nunca registrar SW em preview Lovable, iframe, dev, `?sw=off`, hostnames `id-preview--*`, `preview--*`, `*.lovableproject.com`, `*.lovableproject-dev.com`, `*.beta.lovable.dev`.
- **Head tags** no `__root.tsx` de cada portal: `link rel="manifest"`, `meta name="theme-color"` (com `media` para claro/escuro), `apple-touch-icon`, `apple-mobile-web-app-capable`.
- **Instalação**: banner discreto de "Adicionar à tela inicial" só depois do primeiro login bem-sucedido, dispensável e não repetido.
- Push notifications: **fora de escopo** (ver seção de integrações). Notificação = registro em tabela + realtime + sino in-app.

## Organização de código (componentes reutilizáveis)

- **Responsabilidade única**: cada arquivo `.tsx` faz uma coisa. Componente com > 300 linhas é sinal de que precisa quebrar.
- **Pasta por domínio**: `src/components/crm/`, `src/components/simulacoes/`, `src/components/financeiro/` etc. Nada de `src/components/utils/` catch-all.
- **Compostos reutilizáveis** (ficam em `src/components/common/`): `PageHeader`, `EmptyState`, `DataTable`, `StatusBadge`/`ToneBadge`, `ConfirmDialog`, `FormField`, `MoneyInput`, `DocInput` (CPF/CNPJ), `PhoneInput`, `DateRangePicker`, `PeriodoFiltro`, `EscopoTabs`, `QuickAction`. Toda tela do sistema consome esses blocos — proibido reimplementar o mesmo padrão em cada rota.
- **Painéis de monitoramento**: usar exclusivamente `src/components/common/dashboard.tsx` (`PanelHeader`, `PanelToolbar`, `SectionTitle`, `HeroMetric`, `MiniMetric`, `PanelCard`, `MetricList`, `AlertRow`). Regra: **1 painel = 1 foco**, máximo 4 heros + 6 mini-métricas + 1 gráfico principal. Detalhe em `08-relatorios-visao-geral.md` (Parte 1).
- **Relatórios ERP**: usar exclusivamente `src/components/reports/*` (`ReportShell`, `ReportSection`, `ReportFiltersBar`, `VisionSelector`, `ReportKpiCard`, `ChartCard`, `DrilldownTable` com totais no rodapé, `ExportButtons`, `GenericReportPage`). Layout obrigatório: cabeçalho executivo → filtros → KPIs → gráficos → ranking → tabela detalhada com totais. Detalhe em `08-relatorios-visao-geral.md` (Parte 2).
- **Hooks** em `src/hooks/` (`useDebouncedValue`, `usePeriodoFiltro`, `useEscopo`, `useRealtimeTable`, `usePermissao`, `useConfirm`). Server functions em `src/lib/<dominio>.functions.ts`. Helpers server-only em `src/lib/<dominio>.server.ts`.
- **Barrel exports** só na pasta `common/`. Nunca em rotas.
- **Nome**: componente em `PascalCase.tsx`, hook em `useCamelCase.ts`, server fn em `verboObjeto` (`getVisaoGeralKPIs`, `criarClienteCRM`).
- **Props**: tipadas com `type` local ao arquivo; nada de `any`. Booleans com prefixo (`isLoading`, `hasError`, `canEdit`).

## Tratamento de erros (obrigatório em TODA feature)

- **Server function**: todo `.handler()` envolve trabalho em `try/catch`. Ao falhar, loga server-side com `console.error('[modulo/funcao]', err)` e devolve `throw new Error("Mensagem amigável em pt-BR")` — nunca vazar mensagem crua do Postgres ou do HomeFin ao usuário.
- **Zod duplo**: validação client (no submit) + validação server (`.inputValidator(schema.parse)`). Mensagens em pt-BR: `"CPF inválido"`, `"Renda deve ser maior que zero"`.
- **Client**: `useMutation` com `onError: (err) => toast.error(err.message)` e `onSuccess: () => toast.success("...")`. Botão fica `disabled` durante `isPending`.
- **Boundaries de rota**: toda rota com loader tem `errorComponent` e `notFoundComponent` (componentes de `src/components/common/RouteError.tsx` e `RouteNotFound.tsx` — reaproveitados em todo o sistema).
- **Rede/HomeFin**: retry idempotente com backoff (helper `retryWithBackoff` em `src/lib/http.server.ts`) só para 429/5xx. Timeout de 20s. Erro 4xx **não** faz retry — devolve erro amigável.
- **Realtime**: subscrição em `useEffect` com cleanup. `onError`/`onClose` do canal reconecta com backoff.
- **Estados vazios** são feature, não erro: `EmptyState` com ilustração/ícone, título, descrição e CTA.
- **Fallback global**: `ErrorBoundary` no `__root.tsx` de cada portal com "Algo deu errado, tente recarregar" + botão de recarga + link "Reportar problema".
- Proibido `alert()`, `confirm()` nativos. Sempre `toast` (sonner) e `ConfirmDialog`.

## Performance

- **Loader + Suspense**: dado inicial vem por `context.queryClient.ensureQueryData(queryOptions)` e componente lê com `useSuspenseQuery`. Nunca `useEffect + fetch` para dado inicial.
- **Paginação** sempre. Nunca listar > 50 linhas de uma vez. Padrão: 25 por página, cursor ou offset conforme volume.
- **Índices**: toda coluna usada em `WHERE`, `ORDER BY`, `JOIN` ou filtro de RLS tem índice. Criar na mesma migração que cria a tabela.
- **Agregações pesadas** viram `SECURITY DEFINER` functions ou materialized views (KPIs de painel geral, ranking, funil).
- **Re-renders**: componentes de lista memoizados (`React.memo`) quando renderizam > 20 itens. `useMemo` para cálculos derivados. `useCallback` só em props passadas para filhos memoizados.
- **Realtime**: canal por página, com `filter` estreito (`table=propostas&filter=id=eq.${id}`). Nunca "escutar tudo".
- **Bundle**: rotas raras usam `lazy` (relatórios, admin). Ícones do `lucide-react` importados um a um (não `import *`).
- **Imagens**: `loading="lazy"` fora do fold. Upload de doc do cliente comprime no browser antes de subir (`browser-image-compression`).
- **Debounce** em busca (`useDebouncedValue`, 300ms). Combobox de CRM com paginação server-side.
- **Cache**: `staleTime` explícito por query (KPI 30s, listagens 10s, dado quase estático 5min).

## Documentação (obrigatória)

- **Cada `.functions.ts` público** começa com bloco JSDoc explicando papel, parâmetros de entrada (Zod), retorno, quem pode chamar (role) e efeitos colaterais (auditoria, e-mail, chamada externa).
- **Cada componente comum** (`src/components/common/*`) tem JSDoc em cima do `export`: descrição em uma linha, exemplo de uso.
- **Cada tabela nova** tem `COMMENT ON TABLE` e `COMMENT ON COLUMN` na migração para as colunas não óbvias.
- **README por módulo** em `src/routes/<modulo>/README.md` com: propósito, rotas, server functions, RLS e diagrama textual do fluxo.
- **`/docs/`** na raiz do repositório mantém o **manual do sistema**: `docs/arquitetura.md`, `docs/fluxos.md`, `docs/permissoes.md`, `docs/integracoes.md`, `docs/design-tokens.md`, `docs/runbook.md` (operação/deploy). Atualizado a cada etapa entregue.
- **Comentários no código** explicam **por quê**, não **o que**. Regra de negócio não trivial (fórmula de comissão, cálculo de SLA, filtro de escopo) vem comentada com referência ao prompt de origem (`// ver 06-financeiro-comissoes.md §3`).

## UX/UI (nível moderno, acessível)

- **shadcn/ui** como base — não reinventar componente que já existe (Dialog, Sheet, Popover, Combobox, DataTable via TanStack Table).
- **Acessibilidade WCAG AA**:
  - Todo botão-ícone tem `aria-label`.
  - Contraste sempre via tokens (`text-foreground`/`bg-background`), nunca `text-gray-300`.
  - Foco visível (`focus-visible:ring-2 ring-ring`) em todo elemento interativo.
  - Um único `<main>` por página, no layout que renderiza `<Outlet />`.
  - Heading hierarchy correta (`h1` único por rota, sem pular níveis).
  - Formulário: `<label>` associado (ou `aria-label`), erro via `aria-describedby`.
  - `lang="pt-BR"` no `<html>`.
- **Feedback imediato**: loading skeletons (não spinner cheio de tela), toasts para sucesso/erro, `optimistic update` em ações rápidas (marcar tarefa, arquivar).
- **Hierarquia visual**: no máximo 2 níveis de ênfase por tela. KPIs "hero" (grandes, coloridos) + KPIs secundários (miniaturas). Evitar "mar de cards iguais".
- **Empty states** ilustrados, com CTA claro.
- **Confirmação** antes de ação destrutiva (`ConfirmDialog` reutilizável).
- **Densidade**: modo confortável por padrão; opção "compacto" nas tabelas grandes (financeiro, relatórios).
- **Animação**: sutil, `transition-all duration-200` em hover; `motion-safe` respeita `prefers-reduced-motion`.
- **Modo escuro** testado tela a tela — nenhum contraste quebrado, nenhuma sombra invisível.

## Padrões de código

- Server function: `createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(zod).handler(async ({ data, context }) => ...)`.
- Nunca chamar server function protegida em loader de rota pública. Só em `_authenticated/*`.
- Nunca importar `client.server.ts` em `.functions.ts` no top-level. Fazer `await import(...)` dentro do handler, após checar role.
- Toda tabela `public.*` recebe `GRANT` explícito para os roles que a RLS libera. `service_role` sempre. `anon` só se houver policy `TO anon`.
- Toda tabela tem `created_at`, `updated_at`, trigger `touch_updated_at`.
- Nenhum `console.log` em produção; erros passam por `error-capture` server-side.
- Nenhum `any` sem justificativa em comentário.
- Lint + typecheck limpos antes de dar etapa por encerrada.

## Definition of Done (aplica-se a cada etapa)

- Migração roda limpa em base vazia, com `GRANT`s corretos e `COMMENT`s explicativos.
- RLS testada com usuário de cada papel (não vê dado alheio).
- Formulário validado com Zod no cliente **e** no servidor, mensagens em pt-BR.
- Todo botão de ação tem estado `loading`, `disabled` e trata erro com `toast`.
- Todo dado sensível auditado e mascarado em log.
- **Layout responsivo verificado em 375, 414, 768, 1024, 1280 e 1440**, sem scroll horizontal.
- **PWA instalável** no portal em que a etapa atua (manifest + ícones + head tags).
- **Modo claro e escuro** verificados na tela nova.
- **Acessibilidade**: `axe` sem erros críticos, navegação por teclado completa, `aria-label` em botões-ícone.
- **Performance**: query paginada, índice criado, sem N+1, sem re-render desnecessário (checar com React DevTools Profiler quando envolver lista).
- **Componentização**: nenhum trecho duplicado — se apareceu 2×, virou componente comum.
- **Documentação atualizada**: JSDoc nas funções novas, README do módulo, e `/docs/*` se mudou fluxo ou permissão.
- **Tratamento de erro**: `errorComponent` + `notFoundComponent` na rota, `try/catch` no handler, toast no client.
