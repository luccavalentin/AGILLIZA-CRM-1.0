# Etapa 05 — Propostas + Integração Bancária 2.0

> Requer 04. Marca branca — nada de "HomeFin"/"Lovable" na UI.

## 1. Produto do módulo

**Tabelas**:

- `propostas` (82 col.) — `numero_proposta PRO-######`, `simulacao_id` nullable (permite manual), `banco_id`, `status` (máquina de estados abaixo), `homefin_id_oportunidade`, snapshot cliente/imóvel/operação.
- `proposta_bancos` (26 col.), `proposta_documentos` (27 col.), `proposta_envolvidos` (41 col.), `proposta_followups` (10 col.), `proposta_historico`, `proposta_logs_homefin`, `proposta_pdfs`.

**Server fns** em `src/lib/propostas/`:

- `propostas.functions.ts`: `criarProposta({simulacao_id?, banco_id, cliente_id?})`, `atualizarProposta`, `cancelarProposta`, `promoverSimulacaoAProposta`, `duplicarProposta`.
- `enviar.server.ts`: `enviarPropostaBanco`, `reenviarProposta`, `sincronizarProposta` (polling GET /oportunidade).
- `proposta-pdf.ts`, `proposta-oficial-pdf.ts`.
- `state-machine.ts` — enum e transições permitidas.

**Cron `/api/public/sync-propostas`** (protegido por `CRON_SECRET`) — chama `sincronizarProposta` para todas com status "aguardando retorno".

## 2. Máquina de estados (2.0 — consolidada)

Status ativos:

- `rascunho` → `enviada_banco` | `erro_envio` | `cancelada`
- `erro_envio` → `enviada_banco` | `cancelada`
- `enviada_banco` → `em_analise_credito` | `credito_aprovado` | `credito_recusado` | `erro_envio` | `cancelada`
- `em_analise_credito` → `credito_aprovado` | `credito_recusado` | `cancelada`
- `credito_aprovado` → `aguardando_documentos` | `cancelada`
- `aguardando_documentos` → `engenharia_vistoria` | `cancelada`
- `engenharia_vistoria` → `analise_juridica` | `cancelada`
- `analise_juridica` → `contrato_emitido` | `cancelada`
- `contrato_emitido` → _(terminal)_
- `credito_recusado` → _(terminal, encerra fluxo)_
- `cancelada` → _(terminal)_

Status legados (`checklist_documentacao`, `cadastro_complementar`, `dossie_completo`, `formularios`, `envio_documentos_banco`, `vistoria_agendamento`, `vistoria_concluida`, `emissao_contrato`, `registrado`) mantidos por compat, mas encaminham para o fluxo simplificado; **não aparecem na UI**.

**Regra visual da timeline** (v2 — sem cadeados): usuário pode **navegar manualmente** para qualquer etapa via clique; servidor revalida `transicaoPermitida(de, para)` no submit. Etapa atual pisca (`animate-pulse`), concluídas em success, próximas em muted.

**Bifurcação**: `credito_recusado` **encerra** o fluxo (etapas seguintes ficam desabilitadas na timeline).

## 3. Telas

### `/operacional/propostas` — lista

Colunas: número, cliente, banco (logo + chip), valor, status (`ToneBadge`), SLA countdown, criada em, responsável, ações. Filtros: status, banco, período, responsável, produto, faixa de valor. Soft-delete ignorado por padrão.

### `/operacional/propostas/nova` e `/enviar` — **Nova Oportunidade**

Dois modos explícitos (RadioGroup no topo):

- **A) Converter simulação existente** (default): combobox busca simulações com `simulacao_bancos.status='simulada'` que ainda não viraram proposta. Pré-preenche tudo, incluindo bancos.
- **B) Cadastrar manualmente**: form em branco, com sub-atalho **"Puxar do CRM"** dentro do bloco Cliente.

Layout: 3 colunas (Operação · Cliente · Financiamento) + tabela de bancos + botão **"ENVIAR PROPOSTA"** (bottom-right, `bg-primary`).

Bloco Bancos: uma linha por banco ativo, colunas: Banco (logo), Simular? (toggle), Nº proposta (opcional), Agência, CC, Dígito. Pelo menos 1 banco ativo antes de enviar.

### `/operacional/propostas/$id` — ficha (**Oportunidade**)

**Header**:

- Título "Oportunidade {codigo_oportunidade_banco || numero_proposta}" + ícone de temperatura/urgência (SLA).
- Subtítulo: "{Operação} · {Situação} há {N} dias".
- KPIs à direita: Banco Escolhido, Inclusão, R$ Financiado, Emissão Prevista, Situação.

**Timeline da proposta** (`src/components/proposta/`): 6 etapas visuais (Simulação → Crédito → Engenharia → Análise Jurídica → Contrato Emitido → Registro). Estados: concluída (preenchido primary), atual (ring + pulse), futura (muted), bifurcada em `credito_recusado`. **Sem cadeados** (v2).

**Tabs** (ordem exata, componente `Tabs` shadcn):

1. **RESUMO** — visão executiva readonly + tabela Bancos/Simulações vinculadas com toolbar (Colunas, Filtros, Exportar, Selecionar Banco, Editar, Novo Banco/Simulação, Incluir Proposta Via API). Modal "Novo Banco/Simulação" no padrão 2 colunas (Dados / Resultado + Dados da Resposta do Banco).
2. **COMPRADORES** — participantes tipo "CO"; modal Puxar do CRM / Cadastro manual; sync com API.
3. **VENDEDORES** — participantes tipo "VD"; mesma UX.
4. **IQ** — Interveniente Quitante (portabilidade/quitação).
5. **IMÓVEL** — grid 2 col. (Dados do Imóvel + Dados da Avaliação); botão "Puxar do cadastro do cliente".
6. **DOCUMENTOS** — checklist do banco; anexar por Puxar do CRM (copia do bucket `cliente-documentos` → `proposta-documentos`) OU Upload manual (**PDF apenas para envio ao banco**, JPG/PNG permitidos localmente). Botão "Enviar Para {Banco}" + "Enviar todos".
7. **ATIVIDADES** — plano operacional automático a partir de `sla_configuracoes`; situações: Não Iniciada / Em Andamento / Concluída / Atrasada.
8. **Follow-up** (v2 — antes "FUP") — grid 2 col.: Incluir Comentário (Interno/Externo) + Histórico com ordem ↑/↓. Externo dispara `POST /oportunidade/{id}/follow-up`.

**Botões de ação** (topo direito): Enviar ao banco, Reenviar (com botão isolado por banco em caso de erro), Solicitar alteração, Cancelar (motivo obrigatório), Baixar PDF, Duplicar, **Sincronizar retorno** (dispara polling manual).

### `/operacional/propostas/kanban`

Kanban por status (colunas: Rascunho, Enviada, Em Análise, Crédito Aprovado, Aguardando Docs, Engenharia, Jurídica, Contrato Emitido, Recusada, Cancelada). Cada card mostra número, cliente, banco (logo), valor, **rastreamento de tempo** (`ago Xd` desde última mudança), SLA countdown. Drag valida via `transicaoPermitida`.

## 4. API HomeFin — endpoints usados

- `POST /oportunidade/{id}/incluir-proposta-integracao` — envia proposta ao banco.
- `POST /documento/{id}/upload` (multipart) — upload de doc.
- `POST /oportunidade/{id}/incluir-documentos-integracao` — envia doc ao banco.
- `POST /oportunidade/{id}/follow-up` — comentário externo.
- `PUT /oportunidade/{id}` — atualização/cancelamento (`tipoSituacao='C'`).
- `GET /oportunidade/{id}` — polling do status (cron `/api/public/sync-propostas`).

**NÃO há webhook**. Retorno é sempre por polling.

## 5. Regras críticas

1. **Sem envio sem consentimento LGPD + SCR** — server fn bloqueia.
2. **Documento >10MB** rejeitado antes do upload; **whitelist** de mimetype.
3. **PII mascarada** em `proposta_logs_homefin` (função `mask_pii_jsonb`).
4. **Cancelamento** exige motivo com `.trim().length ≥ 5`; propaga `tipoSituacao='C'` à API.
5. **Simulação → Proposta** é snapshot congelado: editar simulação depois **não** altera proposta.
6. **Trigger `on_proposta_contrato_emitido`** cria automaticamente:
   - `financial_receivables` (banco → correspondente, comissão bruta).
   - `financial_payables` (correspondente → parceiro, split parceiro).
   - Move card do cliente para `contrato_emitido` na esteira.
   - Dispara notificação in-app para responsável + cliente.
7. **Blindagem de propostas deletadas** — RLS bloqueia acesso mesmo por URL direta.
8. **Trava tenant** — `correspondente_id` é reforçado no INSERT/UPDATE (não vem do body).

## 6. PDF de proposta oficial

`src/lib/propostas/proposta-oficial-pdf.ts` (portrait) — usado para clientes finais/banco. Marca d'água Agilliza, logo do banco no cabeçalho, dados completos da operação, participantes, imóvel, documentos anexados, timeline. Numeração `PRO-######`. Arquivo persistido em `proposta_pdfs` + bucket `documentos-proposta`.

## 7. Notificações desta etapa

- Retorno de crédito (aprovado/recusado) → notifica responsável + cliente (via App Cliente Etapa 09).
- Documento reprovado pelo banco → notifica responsável + cria tarefa "Corrigir doc X".
- Contrato emitido → notifica responsável + financeiro + parceiro + cliente.

## 8. Definition of Done

- Promover simulação em proposta preserva snapshot e todos os campos.
- Proposta manual sem simulação funciona (`simulacao_id` NULL).
- Enviar sem consentimento → bloqueado com mensagem clara.
- Documento >10MB → rejeitado antes do upload.
- Callback (polling) atualiza status; UI reflete em <5s.
- Contrato emitido → contas criadas (validar `comissao_regras`) + esteira avança.
- Cancelar com motivo curto → bloqueado; com válido → cancela + propaga.
- Timeline navegável clicando; servidor revalida transição.
- Kanban rastreia tempo em cada coluna.
- PDF oficial em portrait com marca d'água, sem citar HomeFin/Lovable.
- RLS: analista `proprios` só vê próprias propostas; parceiro só vê onde é `parceiro_id`.
