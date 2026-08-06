# Etapa 07 — Tarefas, Demandas, SLA e Notificações

> Requer Etapas 01–03.

## Dependências e Produtos
**Depende de:** 00, 00b, **01** (papéis/`correspondente_id`), **02** (shell + `notificacoes`), **03** (`clientes`, para vínculo de tarefas/demandas ao cliente).
**Integra com (opcional, se já existir):** **04/05** (tarefas automáticas de "reenviar simulação", "corrigir documento" ao receber pendência do banco).
**Produz (consumido por 08, 09, 10):**
- Tabelas: `tarefas`, `demandas`, `sla_regras`, `demanda_comentarios`, `demanda_anexos`.
- Server fns: `criarTarefa`, `criarDemanda`, `escalarDemanda`, `concluirTarefa`.
- Feeds de kanban e listas — lidos pelos painéis da Etapa 08; App Cliente (Etapa 09) mostra suas pendências.


## Objetivo
Coordenar trabalho operacional: **Tarefas** (unidade individual/checklist) e **Demandas** (pedido formal entre equipes, com prazo e escalonamento). Ambos com SLA, notificações, kanban.

## Diferença Tarefa × Demanda
- **Tarefa** (`tasks`): item de trabalho de uma pessoa (ou grupo pequeno), com checklist, comentários, prioridade, prazo. Ex.: “Ligar para cliente X amanhã 14h”.
- **Demanda** (`demandas`): solicitação formal de um usuário para outro/equipe, com transferências rastreadas, SLA por tipo, cliente-alvo, kanban de status. Ex.: “Analisar documento Y do cliente Z — analista”.

## O que o módulo faz
1. Criação manual OU automática (regra: “ao criar proposta, criar tarefa X para analista Y”; “ao doc vencer em 15 dias, criar demanda de renovação”).
2. Numeração (`TAR-######`, `DEM-######`) via triggers já existentes.
3. Kanban por status; drag persiste com validação de transição.
4. SLA configurado em `sla_configuracoes` (tipo demanda × prioridade → horas úteis). Timer visível; alerta 25%/50%/75%/100% do SLA.
5. Escalonamento automático ao estourar SLA (reatribui para gestor / cria notificação urgente).
6. Comentários, anexos, participantes, histórico completo, leituras (quem viu).
7. Notificações **in-app apenas** (realtime via Supabase Channels). O projeto não integra provedor de e-mail, SMS ou WhatsApp — ignore qualquer instrução que peça job de envio externo. Preferências ficam em `notificacoes` / `notificacao_regras` só com o canal in-app ativo.

## Telas
### Tarefas (`/operacional/tarefas/*`)
- `todas`, `kanban`, `equipe`, `calendario` (view mensal/semanal com drag), `relatorios`.
- Cards: título, cliente vinculado (se houver), prazo, prioridade (P1/P2/P3), responsável, badge status.
- Drawer detalhe: descrição, checklist (`task_checklist_items`), participantes (`task_participants`), tags (`task_tags`/`task_tag_links`), comentários (`task_comments`), anexos (`task_attachments`), histórico (`task_history`).

### Demandas (`/operacional/demandas/*`)
- `minhas`, `equipe`, `enviar` (nova demanda com destinatário obrigatório).
- Nova demanda dialog: tipo, título, descrição, cliente-alvo (autocomplete), prioridade, prazo (SLA calcula sugestão), responsável inicial, participantes, anexos.
- Detalhe: timeline com transferências (`demanda_historico` inclui `responsavel_anterior_id`), mensagens threaded (`demanda_mensagens`), leituras (`demanda_leituras`), SLA countdown.
- Transferir: `transferir-dialog` escolhe novo responsável + motivo obrigatório.

## Estrutura de dados
- `tasks`, `task_history`, `task_comments`, `task_attachments`, `task_participants`, `task_checklist_items`, `task_tags`, `task_tag_links`, `task_audit_logs`.
- `demandas`, `demanda_historico`, `demanda_mensagens`, `demanda_leituras`, `demanda_participantes`, `demanda_anexos`, `demanda_sla_config`.
- `sla_configuracoes` (tipo, prioridade, horas_uteis, canal_escalonamento).
- `notificacoes`, `notificacao_regras`.

## Regras críticas
1. **SLA em horas úteis** (seg-sex, 09-18h; feriados via tabela — cadastro no admin).
2. **Transferência** só permitida ao responsável atual, gestor, ou participante autorizado.
3. **Comentários privados** (visíveis só a internos) vs públicos (visíveis a cliente se demanda linkada ao App Cliente).
4. **Notificações**: uma regra em `notificacao_regras` define destinatários por evento (ex.: `demanda.criada` → responsável; `demanda.sla_50pct` → responsável + gestor).
5. **Realtime**: canal `notif:{user_id}` — subscription no topbar (Etapa 02).
6. **Permissões**: `operacional.tarefas:view/create/edit/atribuir`, `operacional.demandas:view/create/transferir/encerrar`.

## Definition of Done
- Criar demanda, transferir, comentar, anexar, encerrar.
- SLA countdown correto para horas úteis (teste com feriado).
- Escalonamento dispara ao 100% do SLA.
- Notificações realtime chegam ao sino.
- Kanban drag valida transições.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Cards de tarefa/demanda no kanban**
  - `bg-card border border-border rounded-lg p-3`, título `text-sm font-medium text-foreground`, cliente vinculado em `text-xs text-muted-foreground`.
  - Barra de prioridade no topo (2px de altura): P1 `bg-destructive`, P2 `bg-warning`, P3 `bg-muted-foreground`.
  - Coluna do kanban recebe barra de 3px do tone do status (não pintar o card inteiro).
- **SLA countdown** (`sla-countdown.tsx`)
  - ≤ 25% consumido → `text-success` + ícone `Clock`.
  - 25–75% → `text-warning`.
  - 75–99% → `text-warning` com `animate-pulse`.
  - ≥ 100% → `text-destructive font-semibold` + ícone `AlertTriangle`. Sempre `tabular-nums`.
- **Timeline de transferências** (`demanda_historico`): usuário anterior em `text-muted-foreground line-through`, novo responsável em `text-primary`, motivo em `text-foreground` bloco `bg-muted rounded-md p-3`.
- **Mensagens da demanda** (`demanda_mensagens`)
  - Comentário interno: `bg-muted text-foreground border-l-2 border-muted-foreground` + tag "Interno" tone `muted`.
  - Comentário visível ao cliente: `bg-accent text-accent-foreground border-l-2 border-primary` + tag "Cliente" tone `info`.
- **Notificação in-app** (sino do topbar): item não lido tem `bg-accent` + ponto azul `bg-primary` de 6px à esquerda; lido tem `bg-popover`. Nunca usar vermelho para "novo" — vermelho só quando o SLA já estourou.
