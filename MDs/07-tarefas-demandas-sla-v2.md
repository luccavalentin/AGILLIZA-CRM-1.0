# Etapa 07 — Tarefas, Demandas, SLA, Central de Chats 2.0

> Requer 01–03.

## 1. Escopo

**Tabelas**:

- `tasks` (15 col.), `task_history`, `task_comments`, `task_attachments`, `task_participants`, `task_checklist_items`, `task_tags`, `task_tag_links`, `task_audit_logs`.
- `demandas` (23 col.), `demanda_historico`, `demanda_mensagens` (10 col.), `demanda_leituras`, `demanda_participantes`, `demanda_anexos`.
- `sla_configuracoes` (9 col.), `sla_catalogo_itens`, `feriados`.
- `notificacoes`, `notificacao_regras`.
- `dm_conversas`, `dm_participantes`, `dm_mensagens` — direct messages entre operadores (Central de Chats).

**Server fns** em `src/lib/operacional/`:

- `tarefas.functions.ts`, `demandas.functions.ts`, `shared.functions.ts`, `export-pdf.ts` (calendário e listas).

## 2. Diferença Tarefa × Demanda

- **Tarefa** (`tasks` — `TAR-######`): item de trabalho pessoal com checklist, tags, comentários, prazo, prioridade P1/P2/P3.
- **Demanda** (`demandas` — `DEM-######`): solicitação formal entre pessoas/equipes, com transferências rastreadas, SLA por tipo, cliente-alvo, kanban de status, chat interno, escalonamento.

## 3. Rotas

### Tarefas

- `/operacional/tarefas` — lista com filtros (status, responsável, prioridade, período, cliente).
- `/operacional/tarefas/kanban` — colunas por status; drag persiste + valida.
- `/operacional/tarefas/calendario` — view mensal/semanal com drag; feriados nacionais destacados; **Dialog centralizado** ao clicar em dia + marca d'água Agilliza no export PDF.

### Demandas (redesenhada em 2.0)

- `/operacional/demandas` — lista.
- `/operacional/demandas/kanban` — refinado visualmente; cards mostram cliente, prazo, SLA countdown, responsável (avatar).
- `/operacional/demandas/$id` — ficha da demanda com:
  - Header: número, título, tipo, cliente-alvo (link), responsável (avatar), prazo, SLA countdown.
  - Timeline de transferências (`demanda_historico`).
  - **Chat da demanda** estilo Instagram (`src/components/operacional/demanda-chat.tsx`) — realtime, threading, indicador digitando, anexos, comentário interno vs. visível ao cliente.
  - Participantes, anexos, leituras (quem viu).

### Central de Chats (**novo em 2.0**)

- `/operacional/chats` — dashboard central estilo Teams/WhatsApp:
  - Coluna 1: lista de conversas (com clientes, DMs entre operadores, chats de demandas) com badge de não lidas + filtros por tipo.
  - Coluna 2: thread ativa.
  - Coluna 3: painel contextual do interlocutor.
  - Todos com **realtime + som + piscar** quando minimizado (via `FloatingChatHost`).

## 4. SLA em horas úteis

- Fuso `America/Sao_Paulo`; horário útil seg–sex 09h–18h; feriados nacionais em `feriados` + `src/lib/feriados-br.ts`.
- Função SQL `add_horas_uteis(base timestamptz, horas int)` calcula prazos.
- `sla_configuracoes(tipo_demanda, prioridade, horas_uteis, canal_escalonamento, ativa)` — CRUD em `/admin/parametros` (Etapa 10).
- Alertas de 25%/50%/75%/100% do consumo → notificação in-app; ao 100% dispara `escalarDemanda` (reatribui para gestor + marca "atrasada").
- Componente `sla-countdown.tsx` mostra tempo restante com cor progressiva.

## 5. Notificações

- Registro em `notificacoes` + realtime pelo canal `notif:{user_id}` do topbar (Etapa 02).
- **Somente in-app** — sem e-mail, SMS, WhatsApp, push.
- Preferências por usuário em `/conta/notificacoes` (`notificacao_regras` + configuração pessoal em `profiles.notificacao_prefs` JSONB): quais telas notificar, som, piscar chat minimizado.
- Regras globais em `/admin/notificacoes` (correspondente/gestor): mapeamento evento → destinatários por papel.

## 6. Regras críticas

1. Transferência de demanda só permitida ao responsável atual, gestor, ou participante autorizado. Motivo obrigatório.
2. Comentários privados (Interno) vs Externo (visível ao cliente se demanda linkada ao App Cliente).
3. Realtime debounced via `realtime-debounce.ts`.
4. Permissões: `operacional.tarefas:view/create/edit/atribuir`, `operacional.demandas:view/create/transferir/encerrar`.
5. Kanban drag valida transições no server.
6. Export de calendário em PDF (portrait) com marca d'água.

## 7. Aparência (2.0)

- Cards Kanban: `bg-card border rounded-lg p-3` com barra superior de prioridade (2px) — P1 destructive, P2 warning, P3 muted-foreground. Coluna recebe barra 3px do tone do status.
- SLA countdown: ≤25% success, 25–75% warning, 75–99% warning `animate-pulse`, ≥100% destructive `font-semibold` + AlertTriangle.
- Timeline de transferências: usuário anterior `line-through muted`, novo em primary, motivo em bloco `bg-muted rounded-md p-3`.
- Chat interno: bolha do outro `bg-muted`, própria `bg-accent`. Tag "Interno" tone muted; "Cliente" tone info.
- Sino de notificação: item não lido `bg-accent` + dot azul 6px; lido `bg-popover`. Vermelho apenas em SLA estourado.

## 8. Definition of Done

- Criar demanda, transferir com motivo, comentar (Interno/Externo), anexar, encerrar.
- SLA countdown respeita feriados brasileiros (validar cenário com feriado no meio).
- Escalonamento dispara ao 100% (verificar `demanda_historico`).
- Realtime chega no sino <1s.
- Kanban drag: transição inválida → toast + volta card.
- Central de Chats abre com todas as conversas + realtime.
- Calendário PDF sai portrait com marca d'água.
- Chat da demanda funciona com múltiplos participantes; indicador digitando aparece.
- Tarefas de propostas rejeitadas por doc geram automaticamente (integração com Etapa 05).
