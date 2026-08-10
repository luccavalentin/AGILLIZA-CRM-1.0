# 00 — Convenções Globais 2.0 (colar no topo de TODA etapa)

> Versão 2.0 — reflete o estado atual do sistema Agilliza (produção). Substitui `00-convencoes-globais.md` como fonte da verdade. Onde houver conflito com prompts antigos, este documento vence.

## 1. Produto

Sistema web + PWA para o correspondente bancário Agilliza operar Financiamento Imobiliário e Home Equity de ponta a ponta. Integra com a **Integração Bancária** (agregador que roteia para Bradesco, Santander e Itaú por padrão; Inter e Caixa pré-cadastrados aguardando homologação). Três portais coexistem no mesmo repositório: interno (`/*`), do cliente (`/cliente/*`) e do parceiro (`/parceiro/*` — unificado com o interno, ver §6). Todos os três são **PWAs instaláveis**.

Módulos ativos (em produção hoje):
1. **CRM** — clientes PF/PJ, esteira 12 etapas, documentos por pastas, chat com cliente, chat entre operadores, parceiros, painel, scan IA (Gemini/OpenAI).
2. **Operacional** — Simulações (rápida local + completa via Integração Bancária), Propostas (com timeline por banco), Tarefas + Kanban + Calendário, Demandas + Kanban + Chat da demanda, Central de Chats (estilo Teams/WhatsApp).
3. **Financeiro** — Contas a Pagar, Contas a Receber, Comissões (banco→correspondente), Repasses/Comissões por Usuário (correspondente→time), Fluxo de Caixa, categorias/CC/formas de pagamento.
4. **RH** — ficha completa do funcionário (documentos CLT, férias, faltas, adiantamentos, descontos, alterações salariais, benefícios), prévia da folha, holerite (INSS/IRRF 2025), integração com Contas a Pagar (dia de pagamento).
5. **Relatórios** — engine única `runReport` alimentando 18 recortes (painel geral, comerciais, simulações, propostas, CRM, clientes, demandas, tarefas, financeiros, comissões, app-cliente, operacional, consolidado, gerencial, personalizados, exportações, RH, matrículas). Export PDF/XLSX com auditoria (`report_audit_logs`, `report_exports`).
6. **Administração** — Pessoas & Níveis de Acesso, Bancos, APIs de IA, Integrações, Parâmetros globais, Auditoria, Backup, Lista de compras (Diversos), Notificações e Regras, Tipos de Pessoa, Scan IA.
7. **App do Cliente** (PWA) — login por CPF/CNPJ + data (sem OTP), timeline 12 etapas, chat com time, upload de doc pela câmera, notificações in-app.
8. **Portal do Parceiro** — UNIFICADO com o shell interno; parceiro usa as mesmas páginas do correspondente, filtradas por escopo "próprios" via matriz de permissões (ver §6).

## 2. Marca branca — regra dura (versão 2.0)

O sistema é marca branca do correspondente Agilliza. **NUNCA** exibir na UI, PDF, e-mail renderizado, `<title>`, `og:*`, alt, notificação, badge, toast, nome de arquivo baixado ou log visível ao usuário:
- "HomeFin", "Homefin", "home fin" ou qualquer variação;
- "Lovable", "lovable.dev", "AI Gateway", "Lovable Cloud";
- nomes de fornecedores de infra (Supabase, Cloudflare, Vercel, etc.).

Permitido apenas em contexto técnico interno invisível ao usuário: nomes de tabelas/colunas (`homefin_bancos`, `homefin_id_oportunidade`, `proposta_logs_homefin`), variáveis de ambiente (`HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`), nomes de server fns (`enviarHomeFin`, `reenviarHomeFin`), arquivos internos da API.

Substituições canônicas na UI (idênticas à v1.0, mantidas):

| Onde antes aparecia | Usar na UI |
|---|---|
| "HomeFin" | "Integração Bancária" / "Provedor de Integração" |
| "Enviar para HomeFin" | "Enviar ao banco" |
| "Logs HomeFin" | "Logs de Integração" |
| "Callback HomeFin" | "Callback de Integração" |
| "Oportunidade HomeFin" | "Oportunidade" |

**DoD**: antes de fechar qualquer tela ou PDF, o agente roda `rg -i "homefin|lovable" ` no que será renderizado e substitui. Falha aqui é bloqueio.

## 3. Stack técnica (fixa, 2.0)

- **Frontend/SSR**: TanStack Start v1 (React 19 + Vite 7 + Cloudflare Workers). Roteamento por arquivo em `src/routes/`. `createServerFn` para lógica servidor. `src/routes/api/public/*` só para webhooks e cron.
- **Banco/Auth/Storage/Realtime**: Supabase. RLS **sempre ligado** em toda tabela de negócio.
- **Estilo**: Tailwind v4 via `src/styles.css` (fonte Inter Variable local, sem CDN). shadcn/ui como base. Modo claro + escuro completos.
- **Estado assíncrono**: TanStack Query no shell (`ensureQueryData` no loader, `useSuspenseQuery` no componente).
- **Formulários**: React Hook Form + Zod (validação dupla client + server).
- **PDF**: `jspdf` + `jspdf-autotable`, portrait, com marca d'água Agilliza. XLSX: `xlsx`.
- **IA (Scan IA)**: chamada direta ao endpoint oficial Gemini (`generativelanguage.googleapis.com`) ou OpenAI, dentro de `createServerFn`. **Zero dependência de Lovable AI Gateway**.

## 4. Bancos parceiros (seed atual)

Toda listagem de banco na UI consome a view `vw_bancos_ativos`. Seed obrigatório em `bancos_parceiros`:

| Banco | Código | `ativo` (seed) | `flag_padrao` | Observação |
|---|---|---|---|---|
| Bradesco | `bradesco` | true | true | Simulação + Proposta |
| Santander | `santander` | true | true | Idem. Home Equity usa rota operacional `Somahome` (idOperacao=6) |
| Itaú | `itau` | true | true | Home Equity **não** disponível (regra: HE não Itaú) |
| Inter | `inter` | false | false | Aguardando homologação |
| Caixa | `caixa` | false | false | Aguardando homologação |

Assets oficiais dos bancos em `src/assets/brand/` (`bradesco.svg`, `santander.svg`, `itau.svg`) — usar `<BancoLogo>` e `<BancoChip>` de `src/components/bancos/`. **Proibido** gerar logo com IA.

### Regras de negócio consolidadas por produto (2.0)

- **Financiamento Imobiliário Residencial (AP/CS)**: LTV até 90%, prazo até 360 meses, todos os bancos ativos.
- **Terreno (TE)**: LTV **máx 70%**, prazo **máx 240m**, **apenas Bradesco**.
- **Imóvel Comercial (SC/SL)**: LTV máx 70%, prazo máx 240m, todos os bancos ativos.
- **Home Equity**: LTV máx 70% (entrada sugerida 30%), prazo máx 240m, **não** Itaú. Santander HE exige rota operacional `Somahome`, situação `U` (usado), endereço completo do imóvel e dados cadastrais (Mãe, Sexo, Profissão) sincronizados.
- **Prazo por idade**: todas as IFs aceitam prazo máximo pela idade "corrida" (mês corrente conta) — proponente mais velho manda. Helper: `src/lib/propostas/prazo.ts` + clamp no envio.
- **Renda mínima**: PRICE 15% da parcela sobre renda total; SAC 30% (teto). Calculado em `src/lib/simulacao/renda.ts` e via chamada direta à API dos bancos quando disponível.

## 5. Papéis e acesso (2.0 — consolidando Etapa 01 e memórias)

Papéis fixos (`app_role`): `admin` (suporte técnico da plataforma, não aparece na UI comercial), `correspondente` (dono do ecossistema, auto-cadastrado em `/auth`), `gestor`, `comercial`, `analista`, `financeiro`, `imobiliaria`, `corretor`, `cliente`.

**Regra de ouro**: quem cria usuário é o correspondente (ou gestor autorizado). O papel `admin` só cadastra correspondente-raiz — no dia a dia comercial ele não aparece.

**3 portas de entrada**:
- `/auth` — correspondente (aba **Criar conta**) e usuários internos (aba **Entrar**).
- `/portal` — cliente final (CPF/CNPJ + data). Sem signup. Cliente é ativado no CRM pelo correspondente/gestor (toggle "Habilitar acesso ao Portal do Cliente").
- `/parceiro` — parceiro (imobiliária/corretor). Sem signup. Login exige `profiles.acesso_tipo='portal_parceiro'` — configurado em `/admin/pessoas`.

**Roteamento pós-login**: decidido pelo toggle **"Acesso ao Portal do Parceiro"** em `/admin/pessoas`, gravado em `profiles.acesso_tipo`. Não é o papel que decide.

**Escopo de dados** por usuário e módulo em `usuario_escopo_dados(uid, modulo)` retornando `todos | equipe | proprios | personalizado`. Escopo personalizado usa `permission_escopo_alvos` + `usuario_escopo_inclui_dono`. Escopo "próprios" **inclui** clientes vinculados via `cliente_parceiros` (parceiro enxerga seus indicados).

## 6. Portal do Parceiro unificado (novidade 2.0)

O parceiro **NÃO** tem shell dedicado. Ele usa as mesmas páginas internas (`/crm/clientes`, `/operacional/simulacoes`, `/operacional/propostas`, `/financeiro/comissoes-usuario`, `/documentos`), com a nav filtrada pela matriz de permissões e escopo "próprios" aplicado por padrão. Rotas antigas `/parceiro/clientes`, `/parceiro/simulacoes`, etc. viram **redirects** para as respectivas rotas do interno. Login em `/parceiro` autentica e navega para `/parceiro-inicio` (dashboard reduzido do parceiro, ainda dentro do shell interno).

## 7. Independência de plataforma

- **Zero dependência de Lovable Cloud / AI Gateway / Vercel-only**. Rodável em Cloudflare Workers, Vercel ou VPS Node.
- Todas as chaves são secrets do dono do sistema (`process.env.*`): `SUPABASE_*`, `HOMEFIN_*`, `GEMINI_API_KEY`/`OPENAI_API_KEY`, `CLIENTE_APP_SESSION_SECRET`, `CRON_SECRET`.
- IA sempre via `fetch` direto ao endpoint oficial dentro de `createServerFn`.
- **Nunca** `https://ai.gateway.lovable.dev`, `@lovable/*`, `lovable-ai-*`.

## 8. Integrações externas — lista fechada (2.0)

1. **Supabase** (Auth, Postgres, Storage, Realtime).
2. **Integração Bancária (HomeFin)** — 100% polling (`/auth/token`, `/oportunidade`, `/simulacao`, `/follow-up`, `/dominios`). **NÃO tem webhook, não tem HMAC** — nunca criar `/api/public/homefin/callback` nem pedir `HOMEFIN_WEBHOOK_SECRET`. Simulação é síncrona; propostas usam `GET /oportunidade/{id}` via `sincronizarProposta` (cron em `/api/public/sync-propostas` protegido por `CRON_SECRET`).
3. **Provedor de IA** (Gemini OU OpenAI) para Scan IA (OCR e extração de campos de documento).

**NÃO existe e não deve ser proposto**: Twilio, Brevo, Resend, SendGrid, Mailgun, WhatsApp Business, Meta Cloud API, SMTP próprio, Web Push, provedor de telefonia, chatbot externo, Zapier/Make/n8n. **Notificação = registro em `notificacoes` + realtime + sino in-app + som configurável** (ver §12).

## 9. Princípios não negociáveis

1. **Segurança em camadas**: RLS + `SECURITY DEFINER` para agregações + validação server-side em `createServerFn`. Nunca confiar no cliente.
2. **Papéis em `user_roles`**, nunca em `profiles`. Verificar via `has_role(uid, role)`.
3. **Segredos** só no servidor (`process.env.*` dentro do `.handler()`). Nunca no bundle client.
4. **LGPD**: consentimento explícito antes de enviar dado ao banco (`consentimento_lgpd`, `consentimento_scr`). Mascarar CPF/CNPJ/renda em logs (`mask_pii_jsonb`). Auditoria de todo acesso a PII em `cliente_auditoria`.
5. **Escopo de dados**: toda listagem respeita `usuario_escopo_dados(uid, modulo)`. Nunca `SELECT *` sem escopo.
6. **Idempotência**: toda chamada externa idempotente por chave de negócio.
7. **Auditoria**: toda mudança de status/envio grava histórico com `usuario_id`, `timestamp`, `payload_anterior`, `payload_novo`.
8. **Mobile-first**: 375×667 é o ponto de partida. Sem overflow horizontal em ≥320px.
9. **SSR-safe**: nada de `window`/`localStorage`/`document` em top-level.
10. **Não reinventar**: shadcn, TanStack, Supabase JS. Nunca roteador/form/tabela próprios.
11. **PROIBIDO DADO MOCKADO / FAKE / DUMMY / FIXTURE / HARDCODED**. Migração só grava dado de referência de domínio (níveis de acesso, etapas do pipeline, tipos de documento, bancos). Testes usam factories dentro do teste.
12. **Soft delete global** — deletados **não** entram em KPI, listagem, filtro ou export por padrão.

## 10. Nomenclatura fixa

- **Papéis**: como em §5.
- **Menu raiz**: Visão Geral · CRM · Operacional · Documentos · Financeiro · Relatórios · RH · Administração · Conta.
- **Prefixos de numeração**: `SIM-######`, `PRO-######`, `DEM-######`, `TAR-######`, `CP-######`, `CR-######`, `HOL-######` (holerite), `FUN-######` (funcionário).

## 11. Aparência — regra que vale em toda tela

- Fonte única: **Inter Variable** (peso 400 corpo, 500 label, 600 título/KPI). Números em `tabular-nums` sempre.
- Cor apenas via **token semântico** (`bg-primary`, `text-muted-foreground`, `border-input`). Proibido `text-white`, `bg-black`, `bg-[#...]`.
- **Marca**: azul profundo `#000F9F` (primary) para ação/foco/link; vermelho `#F5333F` (destructive) **só** para erro/destrutivo/SLA estourado; verde `#10A37F` (success); âmbar `#EAB308` (warning). Sem gradiente decorativo, exceto sidebar dark e barra fina de SLA.
- Modo claro (padrão) + escuro completos; toggle no topbar; persiste em `localStorage` + `profiles.tema_preferido`.
- Contraste AA sempre; foco visível `focus-visible:ring-2 ring-ring ring-offset-2` em todo interativo.
- Cores/gradiente/detalhes canônicos: ver **`00b-tons-cores-design-tokens-v2.md`**.

## 12. Notificação in-app + som (2.0)

- Tabela `notificacoes(user_id, tipo, titulo, corpo, link, lida, created_at)` + `notificacao_regras(evento, publico, ativo)`.
- Preferências por usuário (canal, sons, quais telas notificar) em `notificacao_regras_usuario` + `/conta/notificacoes` (mesmo painel de `/admin/notificacoes`).
- Som de chat: `src/lib/chat-sound.ts` (Web Audio) + `useIncomingChatSound`. Aplicado em CRM Chat, Chat do Cliente, Central de Chats, Chat de Demanda. Toggle em `/conta/perfil` e `/cliente/perfil`.
- Chat minimizado **pisca** ao receber nova mensagem (classe `chat-blink` em `styles.css` + hook `useChatFlash`).

## 13. Responsividade

- Mobile-first. Testar 375, 414, 768, 1024, 1280, 1440. **Zero** overflow horizontal em ≥320px.
- Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Tabelas grandes viram cards em `<md` OU ganham `overflow-x-auto` + `sticky left-0` na primeira coluna.
- Sidebar fixa em `lg+`; drawer (`Sheet`) em `<lg`.
- Alvos clicáveis mínimo 44×44px em mobile.
- Modais viram `Drawer` bottom-sheet em `<md`.
- Todos os 3 portais são PWA instaláveis. SW **apenas** no App Cliente (offline). Portais interno/parceiro são manifest-only.

## 14. Organização de código

- **Pasta por domínio** em `src/components/` (`crm/`, `simulacao/`, `propostas/`, `operacional/`, `financeiro/`, `rh/`, `reports/`, `admin/`, `cliente/`, `bancos/`, `documentos/`, `formularios/`, `matriculas/`, `common/`, `shared/`, `pwa/`, `legal/`, `brand/`).
- **Reutilizáveis em `common/`**: `PageHeader`, `EmptyState`, `DataTable`, `ToneBadge`/`StatusBadge`, `ConfirmDialog`, `FormField`, `MoneyInput`, `DocInput`, `PhoneInput`, `DateRangePicker`, `PeriodoFiltro`, `EscopoTabs`, `ComboSelect`/`ComboFiltro` (input+pesquisa+seleção), `date-input.tsx` (sem autocomplete de navegador), `dashboard.tsx` (`PanelHeader`, `PanelToolbar`, `HeroMetric`, `MiniMetric`, `PanelCard`, `MetricList`, `AlertRow`).
- **Reports (`components/reports/`)**: `ReportShell`, `ReportSection`, `ReportFiltersBar`, `VisionSelector`, `ReportKpiCard`, `ChartCard`, `DrilldownTable` (com totais no rodapé), `ExportButtons`, `ReportView`.
- **Server fns** em `src/lib/<dominio>/*.functions.ts`. Server-only em `src/lib/<dominio>/*.server.ts`. Import de `client.server.ts` **apenas dentro do handler** com `await import(...)`.
- Componente com > 300 linhas quebra em subcomponentes.

## 15. Tratamento de erros

- `try/catch` em todo `.handler()`. Ao falhar: `console.error('[modulo/funcao]', err)` + `throw new Error("mensagem amigável pt-BR")`. Nunca vazar erro cru do Postgres/HomeFin.
- Validação Zod duplo (client + server).
- Mutations com `onError: (err) => toast.error(err.message)`.
- Toda rota com loader tem `errorComponent` e `notFoundComponent`.

## 16. Definition of Done geral

- `bun run build:dev` OK, `tsgo` sem erro, `supabase--linter` sem warning novo.
- Zero `console.log` em produção, zero `any` sem justificativa.
- Zero mock/fake/dummy em código de produção.
- Modo claro e escuro validados.
- Responsivo em 375/414/768/1024/1280/1440 sem overflow.
- Varredura final `rg -i "homefin|lovable"` limpa no que é renderizado.
- RLS validada com `supabase--linter` e teste manual com pelo menos 2 papéis.
