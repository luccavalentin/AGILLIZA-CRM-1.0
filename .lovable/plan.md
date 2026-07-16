# Central de Conversas — Operacional › Chats

Hub único inspirado em Teams/WhatsApp com todos os históricos de conversa do usuário, unificando design, som, "digitando…", flutuante e realtime.

## Localização
- Novo item de menu em **Operacional › Chats** (rota `/operacional/chats`), logo abaixo de "Demandas".
- Mantém o item "Chat" do CRM e as conversas dentro de cada demanda funcionando (a central apenas reúne tudo).

## Estrutura da tela
Layout de 3 colunas (Teams-like), responsivo (mobile empilha lista → conversa):

```text
┌───────────────┬──────────────────────────────────┐
│ Sidebar       │  Cabeçalho da conversa           │
│ ┌───────────┐ │  Nome · status · ações           │
│ │ Abas      │ ├──────────────────────────────────┤
│ │ Tudo /    │ │                                  │
│ │ Diretas / │ │  Mensagens (mesmo design de      │
│ │ Clientes/ │ │  chat-cliente-tab: bolhas,       │
│ │ Demandas  │ │  âncoras, "digitando…", som)     │
│ ├───────────┤ │                                  │
│ │ Busca     │ ├──────────────────────────────────┤
│ │ + Nova DM │ │  Composer                        │
│ ├───────────┤ │                                  │
│ │ Lista de  │ │                                  │
│ │ threads   │ │                                  │
│ └───────────┘ │                                  │
└───────────────┴──────────────────────────────────┘
```

**Abas** na sidebar:
1. **Tudo** — feed misto ordenado por última mensagem.
2. **Diretas** — DMs entre usuários internos (novo).
3. **Clientes** — reaproveita `crm_chat_meta` + `cliente_app_mensagens`.
4. **Demandas** — threads via `demanda_mensagens`.

Cada item mostra: avatar/iniciais, nome, prévia da última mensagem, timestamp relativo, badge de não lidas.

**"+ Nova conversa"** abre popover com busca de colegas (`profiles` do mesmo `correspondente_id`, com login habilitado) — clique inicia/abre DM 1:1.

## Backend (nova estrutura para DMs internas)

Nova migration cria:

- `dm_conversas` — conversa entre 2+ usuários internos.
- `dm_participantes` — vínculo user↔conversa + `ultima_leitura_em` (badge de não lidas).
- `dm_mensagens` — mensagens (texto + anexo opcional já no bucket existente).
- Função `dm_get_or_create_1on1(_other uuid)` — SECURITY DEFINER, garante conversa única por par.
- Trigger `dm_after_insert_mensagem` — dispara `emitir_notificacao` para o outro participante.
- RLS: participante lê/escreve; escopo pelo `correspondente_id` do criador.
- `ALTER PUBLICATION supabase_realtime ADD TABLE dm_mensagens, dm_conversas, dm_participantes` para realtime.

Server functions em `src/lib/chats/central.functions.ts`:
- `listarThreadsCentral()` — retorna união (DMs, clientes, demandas) já ordenada + contadores de não lidas.
- `buscarColegas(termo)` — autocomplete para DM nova.
- `iniciarDM(other_user_id)` — chama `dm_get_or_create_1on1`.
- `listarMensagensDM(conversa_id)`, `enviarMensagemDM(conversa_id, texto, anexo?)`, `marcarLidoDM(conversa_id)`.

## Frontend

Novos arquivos:
- `src/routes/_authenticated/operacional.chats.tsx` — rota principal.
- `src/components/operacional/central-chat/sidebar-threads.tsx` — abas + lista + busca + nova DM.
- `src/components/operacional/central-chat/dm-conversa.tsx` — motor de conversa DM (mesmo visual das outras).
- `src/lib/chats/central.functions.ts` — server functions listadas acima.
- `src/hooks/use-dm-realtime.ts` — subscribe em `dm_mensagens`.

Reaproveita:
- `ChatClienteConversa` para threads de cliente.
- `DemandaChatConversa` para threads de demanda.
- `useIncomingChatSound`, `useChatTyping`, `signalIncomingChat` (já globais).
- `abrirChatFlutuante` / `abrirDemandaChatFlutuante` + novo `abrirDMFlutuante` no `floating-chat-store` (adiciona `kind: "dm"`).

Menu (`nav-config`): adicionar entrada "Chats" sob Operacional, com badge de não lidas somado.

## Recursos incluídos no v1
- Design unificado das 3 conversas (mesma bolha/composer/tokens).
- Busca de colegas para iniciar DM (autocomplete).
- Realtime de mensagens + "digitando…" + som + pisca-menu (já existentes, plugados na DM).
- Contador de não lidas por thread e agregado.
- Anexos usando bucket existente `chat-anexos` (mesma UX das outras conversas).
- Botão "Soltar chat" → janela flutuante global.

## Fora do v1 (avisar ao usuário)
- Grupos internos (N usuários).
- Menções `@usuario` com notificação específica.
- Presença online / última vez visto.
- Busca full-text em todas as threads (v1 tem busca por nome da thread).

Se preferir incluir alguma dessas no v1, me avise antes de eu executar.

## Passos de execução
1. Rodar migration das tabelas DM + RLS + realtime + função `dm_get_or_create_1on1`.
2. Criar server functions + hook realtime.
3. Criar rota `/operacional/chats` + componentes da central.
4. Estender `floating-chat-store` com `kind: "dm"` e `FloatingChatHost`.
5. Adicionar item no menu + badge agregado.
6. Typecheck.

Confirma que posso executar? (Se quiser grupos/menções/presença no v1, diz agora — dobra o escopo, mas faço junto.)
