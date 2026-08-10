# Etapa 21 — QA Chats Operacionais

## Escopo auditado
- Central de Conversas (`/operacional/chats`) unificando DMs internas, chats de cliente (portal) e chats de demanda.
- Chats vinculados: demanda (`demanda_mensagens` + `demanda_leituras` + `demanda_participantes`), tarefa (`task_comments`) e proposta (histórico + comentários em `proposta_historico`; não há canal dedicado).
- Gestão de estado (`chat_estado_usuario`), etiquetas (`crm_chat_etiquetas`), participantes (`crm_chat_participantes`), meta SLA (`crm_chat_meta`).
- Flutuantes globais (`floating-chat-host.tsx`) com piscar (`useChatFlash`) e som (`useIncomingChatSound`).

## Correções aplicadas nesta etapa
1. **`iniciarDm`** — validação defensiva: mesmo `correspondente_id`, sem auto-DM, exige `ativo=true` e `login_habilitado=true` no interlocutor antes de acionar o RPC.
2. **`enviarMensagemDm`** — bloqueia inserção se o autor não é participante da conversa (`dm_participantes`), mesmo quando RLS falha em cobrir.

## Checklist QA

### Criação de conversa
- [ ] DM 1:1: `iniciarDm` retorna id existente quando já há conversa (idempotente via RPC `dm_get_or_create_1on1`).
- [ ] Bloqueia DM consigo mesmo (erro pt-BR).
- [ ] Bloqueia DM entre correspondentes distintos.
- [ ] Bloqueia DM com usuário `ativo=false` ou `login_habilitado=false`.
- [ ] Busca de colegas (`buscarColegasDm`) só lista mesmo correspondente, ativos e habilitados.

### Conversas vinculadas
- [ ] Demanda: mensagens aparecem em `central-chat` sob `kind=demanda`, com `numero` como subtítulo.
- [ ] Demanda: usuário sem vínculo (nem criador, nem responsável, nem participante) NÃO enxerga a thread (RLS `demanda_mensagens`).
- [ ] Tarefa: comentários em `task_comments` — usuário sem participação nem responsabilidade NÃO enxerga (`task_participants`).
- [ ] Proposta: histórico/comentários vinculados por `proposta_id` — usuário sem escopo não lista.
- [ ] Cliente: só quem tem acesso ao cliente (RLS `cliente_app_mensagens`) enxerga a thread.

### Envio / recebimento
- [ ] `enviarMensagemDm` insere `correspondente_id` do autor (RLS).
- [ ] Envio bloqueado quando não-participante (novo check).
- [ ] Envio bloqueado quando texto vazio ou >4000.
- [ ] Recebimento aparece em <2s via realtime subscription (`postgres_changes` em `dm_mensagens`/`demanda_mensagens`).

### Não lidas / confirmação de leitura
- [ ] Badge de não lidas para DM = mensagens de outros com `created_at > dm_participantes.ultima_leitura_em`.
- [ ] `marcarDmLida` atualiza `ultima_leitura_em` do próprio participante.
- [ ] Demanda: contagem usa `demanda_leituras.lida_em` do próprio usuário.
- [ ] Cliente: contagem de `remetente_tipo='cliente' AND lida_em IS NULL`.

### Anexos
- [ ] DM: `anexo_url` + `anexo_nome` exibidos com link download.
- [ ] Demanda: `demanda_anexos` — só quem enxerga a demanda vê anexos.
- [ ] Tipos aceitos e limite de tamanho conferem com bucket.

### Respostas, reações, pesquisa (gaps documentados)
- [ ] **Gap**: threads/reply-to não implementado em `dm_mensagens` (sem coluna `parent_id`).
- [ ] **Gap**: reações (emoji) não implementadas.
- [ ] Pesquisa: filtro em `central-chat` por título/mensagem (client-side sobre lista carregada).
- [ ] Pesquisa avançada por período/autor/anexo — pendente.

### Histórico
- [ ] `listarMensagensDm` ordena `created_at ASC` (paginação: pendente para >1000 msgs).
- [ ] Auditoria de exclusão de mensagem: pendente (mensagens não são deletáveis pela UI hoje).

### Notificações
- [ ] Nova mensagem gera notificação in-app quando destinatário está offline (regra `notificacao_regras`).
- [ ] Chat minimizado pisca via `useChatFlash` até ser aberto.
- [ ] Som opcional (`useIncomingChatSound`) respeita preferência do usuário.

### Permissões / segurança
- [ ] RLS `dm_conversas` / `dm_participantes` / `dm_mensagens` — apenas participantes leem/escrevem.
- [ ] RLS `demanda_mensagens` — restrito a criador/responsável/participante.
- [ ] RLS `cliente_app_mensagens` — restrito ao escopo do cliente.
- [ ] Rota `/operacional/chats` sob `_authenticated` — sem sessão redireciona a `/auth`.
- [ ] Correspondente e Parceiro compartilham o MESMO shell/tela; parceiro só enxerga clientes/demandas vinculados (RLS + escopo).

### Exclusão
- [ ] Ocultar conversa (`chat_estado_usuario.oculto_em`) — só afeta o usuário.
- [ ] Arquivar conversa (`arquivado_em`) — some da lista principal, aparece em Arquivados.
- [ ] **Gap**: exclusão física de mensagem individual não exposta (evita perda de trilha).

### Auditoria
- [ ] Alterações de etiqueta / apelido / fixar / arquivar ficam em `chat_estado_usuario` (por usuário) e `crm_chat_meta` (por chat).
- [ ] **Gap**: log dedicado de mensagens enviadas (LGPD) — hoje só via `dm_mensagens` timestamp.

### Correspondente ↔ Parceiro
- [ ] Ambos os portais usam `src/routes/_authenticated/operacional.chats.tsx` com o mesmo componente `CentralChat`.
- [ ] Nenhuma feature exclusiva por portal; diferenças = escopo de dados (via nav-config + RLS).

## Gaps priorizados (backlog)
1. Threads/reply-to e reações emoji.
2. Paginação de histórico (janela >1000 mensagens).
3. Pesquisa full-text server-side (título + corpo + autor).
4. Log de auditoria dedicado de envio/edição/exclusão de mensagem (LGPD).
5. Confirmação de leitura granular por mensagem (hoje é por conversa).
