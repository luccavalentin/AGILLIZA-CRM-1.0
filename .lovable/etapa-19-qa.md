# Etapa 19 — QA · Tarefas

## Correções aplicadas nesta etapa

1. **`listarTarefas` — bug do `.or()` com `in.(...)`**: quando o usuário no escopo _Minhas_ tinha ≥2 clientes-parceiros, o filtro `cliente_id.in.(uuid1,uuid2)` era enviado dentro de `.or(...)`, cujas vírgulas colidem com o separador de OR e derrubavam a consulta silenciosamente. Substituído por múltiplos `cliente_id.eq.<id>` concatenados no `.or()`.
2. **`listarTarefas` — filtros e ordenação**: adicionados `prioridade`, `responsavel_id` e `ordem` (`prazo` | `prioridade` | `recentes`). O escopo `equipe`, que era declarado mas não implementado, foi removido do union.
3. **Solicitante no payload**: agora `listarTarefas` retorna `criador_id`, `nome_solicitante` e `concluida_em`, permitindo exibir quem abriu a tarefa e quando foi concluída.
4. **Conclusão / reabertura**: `moverStatusTarefa` e `concluirTarefa` passaram a carimbar `concluida_em` na conclusão e a **limpá-lo** na reabertura, mantendo relatórios/SLA consistentes.
5. **Notificação ao solicitante**: quando outro usuário conclui a tarefa, o criador recebe uma notificação in-app (`tarefa.concluida`). Comportamento simétrico ao já existente `tarefa.atribuida` para o responsável.
6. **`atualizarTarefa`** — nova server function para edição de campos básicos (título, descrição, prioridade, prazo, cliente, responsável), com histórico "editada".
7. **Auditoria de exclusão**: `excluirTarefa` agora grava snapshot completo em `task_audit_logs` (`acao='excluida'`) antes de apagar a linha, cobrindo a exigência de auditoria da etapa.

## Módulo — estado atual

- **Backend**: `src/lib/operacional/tarefas.functions.ts` (server fns) + RLS via `usuario_tem_acesso_tarefa(uid, task_id)`.
- **Rotas**: `/operacional/tarefas` (lista agrupada), `/operacional/tarefas/kanban`, `/operacional/tarefas/calendario`, drawer modal para detalhes.
- **Storage**: bucket `tarefa-anexos` (privado, URL assinada 5 min).
- **Tabelas**: `tasks`, `task_checklist_items`, `task_participants`, `task_comments`, `task_history`, `task_tags`, `task_tag_links`, `task_attachments`, `task_audit_logs`.
- **Notificações**: `emitir_notificacao` RPC — cobre `tarefa.atribuida` (criação) e `tarefa.concluida` (após correção).
- **Escopo do parceiro**: `listarClienteIdsParceiroDoUsuario` alimenta o filtro _Minhas_; o Portal do Parceiro consome a mesma rota (`portal-parceiro-unificado`), apenas os itens visíveis por RLS aparecem.

## Gaps conhecidos (documentados; **não implementados** nesta etapa)

- **Recorrência**: `tasks` não possui coluna de recorrência nem job de geração. Se o produto exigir tarefas recorrentes, incluir em `parametros_globais`/cron dedicado.
- **Lembretes**: não há tabela de lembretes agendados. Os únicos gatilhos temporais são a exibição de "vencidas" (prazo < agora) e "para hoje". Notificações agendadas antes do prazo requerem cron + `notificacao_regras`.
- **Edição pelo drawer**: o server fn `atualizarTarefa` existe, mas o drawer ainda não expõe UI de edição (somente comentários/anexos/checklist/tags). Habilitar quando o produto solicitar.

## Checklist QA (aceite)

### Criação

- [ ] Título obrigatório (≥2 caracteres).
- [ ] Prioridade padrão `p2`; prazo opcional (`datetime-local`).
- [ ] Responsável default = usuário atual; permite escolher qualquer membro do correspondente.
- [ ] Cliente opcional; quando preenchido, RLS permite que o cliente-vinculado (parceiros) enxergue a tarefa.
- [ ] Checklist inicial é gravado em `task_checklist_items` com `ordem` sequencial.
- [ ] Histórico `criada` é inserido.
- [ ] Se responsável ≠ criador, o responsável recebe notificação `tarefa.atribuida`.

### Edição

- [ ] `atualizarTarefa` altera título/descrição/prioridade/prazo/cliente/responsável; NÃO altera status/número/criador/correspondente.
- [ ] Histórico `editada` é registrado.

### Conclusão / reabertura / cancelamento

- [ ] Concluir grava `concluida_em = now()` e notifica o criador (quando outro usuário concluiu).
- [ ] Reabrir (mover para `aberta`/`em_andamento`) zera `concluida_em`.
- [ ] Cancelar segue transição livre (`TRANSICOES` = todos ↔ todos).
- [ ] `Kanban` drag & drop valida `transicaoTarefaPermitida` (atualmente aceita qualquer mudança) tanto no cliente quanto no servidor.

### Exclusão

- [ ] Somente `admin`/`correspondente`/`gestor` OU criador podem excluir (RLS `tasks delete`).
- [ ] Snapshot da tarefa é inserido em `task_audit_logs` com `acao='excluida'`.

### Responsável / Solicitante / Participantes

- [ ] `nome_responsavel` e `nome_solicitante` (criador) aparecem na lista.
- [ ] Participantes adicionados no dialog gravam em `task_participants`; RLS permite que participantes vejam a tarefa (função `usuario_tem_acesso_tarefa`).

### Prioridade / Prazo / Status

- [ ] Ordenação por `prioridade` retorna p1 → p2 → p3.
- [ ] Ordenação por `prazo` respeita `nulls last`.
- [ ] KPIs (`Para hoje`, `Vencidas`, `Conclusão`) refletem status e prazo corretamente.

### Anexos

- [ ] Upload para bucket `tarefa-anexos` no path `<task_id>/<ts>-<nome>` (sanitizado).
- [ ] `registrarAnexoTarefa` insere linha em `task_attachments` + histórico `anexo`.
- [ ] URL assinada expira em 300s.
- [ ] Remover anexo apaga do storage antes de remover o registro.

### Comentários

- [ ] Insere com `autor_id = auth.uid()` (RLS `with_check`).
- [ ] Aparece em tempo real na visualização (após `invalidateQueries`).

### Checklist interno

- [ ] `toggleChecklistItem` marca/desmarca; itens são ordenados por `ordem`.
- [ ] Progresso reflete no drawer.

### Etiquetas (tags)

- [ ] `criarTagTarefa` limita ao correspondente (RLS `task_tags gestao`).
- [ ] `alternarTagTarefa` faz upsert / delete no `task_tag_links`.

### Notificações

- [ ] Atribuição: responsável ≠ criador ⇒ `tarefa.atribuida` chega em <2s (realtime `notificacoes`).
- [ ] Conclusão: quando o solicitante não é quem concluiu ⇒ `tarefa.concluida` disparada.
- [ ] Vencimento: NÃO implementado (gap documentado).

### Filtros / Busca / Ordenação

- [ ] Busca por título com `ilike %q%`, debounce ~300ms (front-end).
- [ ] Filtro por prioridade, responsável, cliente, status.
- [ ] Ordem: `recentes` (padrão), `prazo`, `prioridade`.

### Visualizações

- [ ] **Lista** agrupa por _A fazer / Em andamento / Concluídas_.
- [ ] **Kanban** com 4 colunas (aberta / em_andamento / concluida / cancelada), drag-and-drop, contagem por coluna.
- [ ] **Calendário** posiciona por `prazo`, respeita feriados nacionais e destaca o dia atual.
- [ ] O escopo (`Minhas` / `Gerais`) é compartilhado entre as três visões via `localStorage.tarefas:escopo`.

### Auditoria

- [ ] `task_history` recebe: `criada`, `status`, `concluida`, `editada`, `anexo`.
- [ ] `task_audit_logs` recebe: `excluida` (snapshot completo).

### Permissões

- [ ] SELECT: qualquer usuário com acesso via `usuario_tem_acesso_tarefa` (responsável, criador, participante, admin/gestor, ou parceiro do cliente).
- [ ] INSERT: apenas dentro do próprio correspondente (política INSERT `tasks`).
- [ ] UPDATE: idem SELECT + `with_check` valida correspondente.
- [ ] DELETE: apenas gestores/admin/correspondente OU criador.

### Comunicação com outros módulos

- [ ] Cliente vinculado: tarefa aparece na aba de tarefas do cliente (mesmo endpoint com `cliente_id`).
- [ ] Proposta / simulação: sem vínculo direto na tabela `tasks`; o vínculo é indireto via `cliente_id`. Documentado — se produto exigir link direto, adicionar coluna `proposta_id`/`simulacao_id` em migração futura.
- [ ] Demandas: são módulo separado (`demandas`, `demanda_*`), sem conflito com Tarefas.
- [ ] Usuários: `listarColegas` alimenta o combo de responsável.
- [ ] Relatórios: `relatorios.tarefas` consome `tasks` com escopo por correspondente (já validado na Etapa 08).

### Correspondente vs Parceiro

- [ ] Parceiro entra em `/operacional/tarefas` (redirect unificado) e vê apenas tarefas cujo `cliente_id` está em `cliente_parceiros` para ele.
- [ ] Nenhum campo interno (responsável de outra equipe, comentários privados) vaza fora do escopo do correspondente do parceiro.
- [ ] UI/visual idêntica à do correspondente, com botões de ação restritos pela matriz de permissões.
