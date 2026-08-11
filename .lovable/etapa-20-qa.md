# Etapa 20 — QA · Demandas

## Correções aplicadas nesta etapa

1. **`listarDemandas` — bug do `.or()` com `in.(...)`**: no escopo _Minhas_, os filtros `id.in.(uuid1,uuid2)` e `cliente_id.in.(uuid1,uuid2)` eram concatenados dentro de `.or(...)`; as vírgulas do `in.(...)` colidem com o separador de OR do PostgREST e derrubavam a consulta quando o usuário tinha ≥2 demandas onde é apenas participante ou ≥2 clientes-parceiros. Reescrito para emitir uma condição `eq.` por id.
2. **Filtros e ordenação**: adicionados `prioridade`, `responsavel_id` e `ordem` (`recentes` | `prazo` | `prioridade`). O escopo `equipe` (usado pelo Kanban) virou alias de `geral` no validador para não quebrar o front-end existente.
3. **Reabertura**: `moverStatusDemanda` agora **limpa `concluida_em`** ao sair do estado `concluida`, mantendo relatórios/SLA consistentes ao reabrir uma demanda.
4. **Transferência**: `transferirDemanda` passa a notificar também o **responsável anterior** (`demanda.transferida`) quando ele perde a titularidade — antes, só o novo responsável era avisado.

## Módulo — estado atual

- **Backend**: `src/lib/operacional/demandas.functions.ts` (server fns) + RLS por escopo/participante/parceiro.
- **Rotas**: `/operacional/demandas` (lista), `/operacional/demandas/$id` (ficha com abas), `/operacional/demandas/kanban`.
- **Componentes**: `nova-demanda-dialog`, `editar-demanda-dialog`, `transferir-dialog`, `adicionar-participante-dialog`, `demanda-chat`, `demanda-page/*`.
- **Storage**: bucket `demanda-anexos` (privado, URL assinada 5 min).
- **Tabelas**: `demandas`, `demanda_historico`, `demanda_mensagens`, `demanda_participantes`, `demanda_anexos`, `demanda_leituras`.
- **RPCs**: `demanda_escalar_vencidas(corr)` para escalar demandas com SLA estourado; `add_horas_uteis(corr, inicio, horas)` para calcular prazo; `emitir_notificacao(...)` para notificação in-app; `portal_time_responder(cid, msg, anexo)` para espelhar comentários públicos no chat do cliente.
- **Realtime**: mensagens de chat e histórico são reidratados via `router.invalidate()` no `chat-alert-watcher` e no `demanda-chat`.

## Semântica de fluxo (aceite / recusa / execução)

O produto não usa server fns dedicados de "aceitar" e "recusar"; o fluxo se resolve pela máquina de estados livre `TRANSICOES` (todos ↔ todos):

- **Envio**: `criarDemanda` — insere `demandas` + `demanda_participantes` e notifica responsável/participantes.
- **Recebimento**: aparece no feed do responsável (`demanda.criada`) e na lista _Minhas_.
- **Aceite**: mover status para `em_andamento`.
- **Recusa**: mover status para `cancelada` (motivo vai no chat/histórico se necessário).
- **Execução**: status permanece em `em_andamento` (ou `aguardando` quando bloqueada por dependência).
- **Conclusão**: mover para `concluida` → carimba `concluida_em`, notifica criador+participantes.
- **Reabertura**: mover de `concluida` de volta para `em_andamento`/`aberta` → limpa `concluida_em` (correção desta etapa).
- **Cancelamento**: mover para `cancelada`.

## Checklist QA (aceite)

### Criação e envio

- [ ] Título ≥2 caracteres, tipo default `diversos`, prioridade default `p2`.
- [ ] Responsável obrigatório; validado como sendo do mesmo correspondente do criador.
- [ ] Cliente/proposta/simulação opcionais; validados como sendo do mesmo correspondente.
- [ ] Participantes opcionais, todos do mesmo correspondente; upsert em `demanda_participantes`.
- [ ] Notificação `demanda.criada` disparada para responsável (se ≠ criador) e cada participante (se ≠ criador).
- [ ] Numeração automática (`numero`) gerada por trigger no banco.
- [ ] SLA inicial: `sla_inicio = now()`, `prazo_sla` calculado se houver `sla_horas` configurado por tipo em `sla_configuracoes`.

### Recebimento

- [ ] Responsável e participantes vêem a demanda em _Minhas_ (escopo já cobre criador/responsável/participante/parceiro do cliente).
- [ ] Notificação in-app aparece em <2s (realtime).
- [ ] Item aparece com contagem `nao_lidas > 0` quando há mensagens novas.

### Aceite / Recusa / Execução

- [ ] Mover para `em_andamento` (=aceite) gera histórico `status` com `detalhe=em_andamento` e notifica contraparte+participantes.
- [ ] Mover para `cancelada` (=recusa) mesmo comportamento, com `_tipo=demanda.status`.
- [ ] Mover para `aguardando` documenta bloqueio.

### Conclusão / reabertura / cancelamento

- [ ] Conclusão carimba `concluida_em = now()`, notifica criador, responsável e participantes (exceto o autor da ação).
- [ ] Reabertura zera `concluida_em` (correção desta etapa).
- [ ] Cancelamento não zera `concluida_em` (irrelevante, pois status ≠ concluída).

### Transferência

- [ ] Somente criador ou responsável podem transferir; motivo (≥3 chars) obrigatório.
- [ ] `responsavel_id` atualizado; `demanda_historico` recebe `acao='transferida'` com `responsavel_anterior_id`/`responsavel_novo_id`/`motivo`.
- [ ] Notifica novo responsável (`demanda.transferida`).
- [ ] Notifica responsável anterior quando distinto do autor da transferência (correção desta etapa).

### Responsável / Solicitante

- [ ] `nome_responsavel`, `tipo_responsavel`, `nome_criador`, `tipo_criador` retornados em `listarDemandas`.
- [ ] `obterDemanda.permissoes` distingue `sou_criador`, `sou_responsavel` e libera edição/exclusão/transferência de acordo.

### Prioridade / SLA / Prazo

- [ ] Ordenação por `prioridade` retorna p1 → p2 → p3 (enum ascendente).
- [ ] Ordenação por `prazo` respeita `nulls last` sobre `prazo_sla`.
- [ ] Edição via `editarDemanda` com `sla_horas` recalcula `prazo_sla` via `add_horas_uteis` (horas úteis do correspondente, fuso America/Sao_Paulo).
- [ ] `escalarDemanda` executa `demanda_escalar_vencidas(_corr)` e marca `escalonada=true` nas demandas com `prazo_sla < now()`.

### Status / Máquina de estados

- [ ] `transicaoDemandaPermitida` permite qualquer transição (livre) — documentado como decisão de produto.
- [ ] Histórico de mudanças em `demanda_historico` com `acao='status'` e `detalhe=<novo_status>`.

### Anexos

- [ ] Upload para bucket `demanda-anexos` no path `<demanda_id>/<ts>-<nome>` (sanitizado).
- [ ] `registrarAnexoDemanda` insere linha em `demanda_anexos`; `removerAnexoDemanda` limpa storage antes do delete.
- [ ] URL assinada expira em 300s.

### Chat

- [ ] `comentarDemanda` valida corpo não-vazio OU anexo; grava em `demanda_mensagens`.
- [ ] `visivel_cliente=true` espelha no App do Cliente via `portal_time_responder`.
- [ ] Notifica todos os envolvidos (criador, responsável, participantes) exceto autor.
- [ ] Contagem `nao_lidas` calculada a partir de `demanda_leituras.lida_em` (usuário atual) vs `created_at` das mensagens de outros autores.
- [ ] `marcarDemandaLida` faz upsert com `now()`.

### Histórico

- [ ] `demanda_historico` recebe: `criada` (via trigger, se existir), `status`, `transferida`, `editada`, `participantes_adicionados`.
- [ ] Nomes de atores/anteriores/novos resolvidos em `obterDemanda`.

### Notificações

- [ ] Tipos: `demanda.criada`, `demanda.transferida`, `demanda.status`, `demanda.mensagem`, `demanda.participante_adicionado`.
- [ ] Todos os disparos são in-app (tabela `notificacoes` + realtime); não há e-mail/SMS/push (conforme mem://conventions/global).
- [ ] Chat piscando (`chat-blink`) e som de notificação (`useIncomingChatSound`) funcionam quando `demanda.mensagem` chega.

### Filtros / Pesquisa / Kanban

- [ ] Busca por `titulo` OU `numero` via `ilike`.
- [ ] Filtro por status, prioridade, responsável, cliente.
- [ ] Kanban 5 colunas (aberta / em_andamento / aguardando / concluida / cancelada), drag-and-drop chama `moverStatusDemanda`.
- [ ] Escopo `Minhas` × `Gerais` persiste em `localStorage.demandas:escopo`.

### Indicadores

- [ ] KPIs do módulo: abertas, em execução, aguardando, vencidas (`prazo_sla < now() AND status NOT IN ('concluida','cancelada')`), escalonadas.
- [ ] Painel `relatorios.demandas` consome os mesmos dados com escopo por correspondente.

### Auditoria

- [ ] Toda mudança relevante gera linha em `demanda_historico` (fonte oficial de auditoria do módulo).
- [ ] Exclusão: apenas o criador pode excluir; cascade remove filhas (participantes, mensagens, anexos, histórico, leituras).

### Permissões

- [ ] RLS SELECT: usuário vê a demanda se for criador, responsável, participante, admin/gestor do correspondente, ou parceiro do cliente vinculado.
- [ ] INSERT: apenas dentro do próprio correspondente.
- [ ] UPDATE: criador, responsável ou gestor/admin.
- [ ] DELETE: apenas criador ou admin.

### Correspondente vs Parceiro

- [ ] Parceiro acessa `/operacional/demandas/*` no shell unificado (`portal-parceiro-unificado`), mesma UI.
- [ ] Escopo do parceiro é limitado a demandas cujo `cliente_id` está em `cliente_parceiros` para ele (ou onde ele é criador/responsável/participante).
- [ ] Ações restritas (excluir, transferir, editar SLA) escondidas via matriz de permissões quando o parceiro não tem os papéis correspondentes.

## Gaps documentados (não implementados nesta etapa)

- **Server fns dedicadas de aceite/recusa**: fluxo é resolvido via `moverStatusDemanda` (`em_andamento` = aceite, `cancelada` = recusa). Se o produto quiser eventos separados, criar `aceitarDemanda`/`recusarDemanda` com histórico próprio.
- **Auditoria de exclusão**: `excluirDemanda` faz hard delete sem snapshot em tabela dedicada — o histórico é apagado por cascade. Migrar para soft-delete ou snapshot em `admin_audit_logs` quando exigido.
- **Máquina de estados**: hoje qualquer transição é permitida. Se o produto exigir bloqueios (ex.: `cancelada → concluida` proibido), reforçar `TRANSICOES`.
- **SLA por tipo de demanda**: a base já suporta via `sla_configuracoes`, mas a UI de cadastro de SLA por tipo é do módulo Admin (Etapa 07).
