## Objetivo

Hoje o chat com o cliente (`cliente_app_mensagens`) é **um só por cliente**: toda a equipe vê e responde as mesmas mensagens. Vamos torná-lo **individual por atendente** — cada usuário tem sua própria conversa com o cliente, e o cliente vê **uma conversa separada por atendente**.

## Arquitetura escolhida

Uma conversa = par **(cliente, atendente)**. Adicionamos `atendente_id` na mensagem:

```text
cliente_app_mensagens
  cliente_id ─┐
  atendente_id ┤─ definem a thread
  remetente_tipo = 'time' | 'cliente'
```

- Mensagem da equipe (`time`): `atendente_id = quem enviou`.
- Mensagem do cliente (`cliente`): `atendente_id = atendente da thread onde ele respondeu`.

**Visibilidade (regra que proponho para gestores):**
- Atendente comum → vê e responde **somente a sua própria** conversa com cada cliente.
- Admin/Correspondente → mantêm uma **visão supervisora** opcional ("Ver todos os atendimentos") para acompanhar as conversas de todos os atendentes (necessário para auditoria/gestão), mas por padrão também abrem só a sua. Ninguém edita/exclui mensagem de outro usuário.

## Mudanças no banco (migração)

1. `ALTER TABLE cliente_app_mensagens ADD COLUMN atendente_id uuid` + índice `(cliente_id, atendente_id, criada_em)`.
2. Backfill:
   - `time` → `atendente_id = remetente_id`.
   - `cliente` → atendente da mensagem `time` mais próxima no tempo; fallback = `clientes.responsavel_id`.
3. Ajustar funções `SECURITY DEFINER`:
   - `portal_time_responder` → grava `atendente_id = auth.uid()`.
   - `portal_time_marcar_lidas` → só marca lidas da thread `atendente_id = auth.uid()`.
   - `portal_enviar_mensagem` → novo parâmetro `_atendente` (thread escolhida pelo cliente).
   - `portal_listar_mensagens` → novo parâmetro `_atendente` (lista a thread específica).
   - Nova `portal_listar_atendentes(_cid)` → lista atendentes com quem o cliente conversa (nome, última mensagem, não lidas).

## Lado da equipe (`src/lib/crm/chat-cliente.functions.ts` + UI)

- `listarConversasCliente`: agrupa por (cliente, atendente); filtra `atendente_id = userId` (gestor com toggle vê todas, mostrando o nome do atendente em cada conversa).
- `listarChatCliente`: passa a aceitar `atendente_id` (default = usuário atual).
- `editarChatCliente` / `excluirChatCliente`: restringir a `remetente_id = userId` (corrige vazamento atual de editar mensagem alheia).
- UI `crm.chat.tsx` / `chat-cliente-tab.tsx`: cada conversa carrega a thread do usuário; para gestores, badge com o nome do atendente e o toggle de visão geral.

## Lado do cliente (PWA `src/lib/portal/cliente.functions.ts` + `cliente.chat.tsx`)

- Nova listagem de **threads por atendente** (usa `portal_listar_atendentes`).
- `listar/enviar/marcar` passam a receber `atendente_id` da thread aberta.
- UI: o cliente escolhe com qual atendente falar (lista de conversas), cada uma isolada.

## Verificação

- Typecheck (`tsgo`).
- Playwright: logar como dois usuários diferentes, conversar com o mesmo cliente e confirmar que cada um vê só a sua thread; no app do cliente, confirmar as conversas separadas por atendente.
