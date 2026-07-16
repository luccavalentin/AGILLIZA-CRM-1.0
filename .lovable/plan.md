## Objetivo

Padronizar a gestão de conversas em todos os chats do sistema — Central de Conversas (DM), Chat do Cliente (CRM), Chat de Demandas e Chat do Portal do Cliente — com as ações: **Arquivar / Desarquivar, Excluir, Editar (renomear/apelido), Etiquetar (marcadores coloridos)**, além de **pesquisa por palavra-chave** (no assunto e no conteúdo das mensagens).

## Escopo

### 1. Banco de dados (migração única)
- Nova tabela genérica `chat_gestao` (por usuário + tipo de chat + id do chat):
  - `usuario_id`, `chat_tipo` (`dm | cliente | demanda | portal_cliente`), `chat_id`, `arquivado_em`, `excluido_em` (soft delete só para o usuário), `apelido`, `pinado_em`, timestamps.
- Nova tabela `chat_etiquetas` (globais por organização, com nome + cor).
- Nova tabela `chat_etiqueta_vinculos` (`etiqueta_id`, `chat_tipo`, `chat_id`).
- Migrar `crm_chat_etiquetas` e `crm_chat_cliente_etiquetas` existentes para o novo modelo, mantendo compatibilidade da tela `/crm/chat`.
- Índices por `(usuario_id, chat_tipo, arquivado_em, excluido_em)` e busca full-text (`tsvector`) em `dm_mensagens`, `cliente_app_mensagens`, `demanda_mensagens` para pesquisa por palavra-chave.
- RLS: cada usuário só vê/gerencia sua própria linha de `chat_gestao`; etiquetas visíveis para todos os autenticados; admin gerencia catálogo.

### 2. Server functions (`src/lib/chats/gestao.functions.ts`)
- `arquivarConversa / desarquivarConversa`
- `excluirConversa` (soft delete por usuário; admin pode excluir "para todos" nos casos DM)
- `renomearConversa` (define apelido pessoal)
- `criarEtiqueta / listarEtiquetas / editarEtiqueta / excluirEtiqueta`
- `aplicarEtiqueta / removerEtiqueta`
- `pesquisarConversas({ q, tipos, incluirArquivadas, etiquetas })` — busca unificada em títulos e mensagens usando `tsvector` + `websearch_to_tsquery('portuguese', ...)`.
- Atualizar `listarThreadsCentral` para respeitar `arquivado_em/excluido_em` e trazer etiquetas + apelido.

### 3. UI compartilhada
- Novo componente `ConversaMenuAcoes` (dropdown com Arquivar, Excluir, Renomear, Etiquetar, Fixar) usado em:
  - Central de Conversas (`central-chat.tsx`) — item da lista + cabeçalho.
  - Chat de Cliente (`chat-cliente-instagram.tsx` e `/crm/chat`).
  - Chat de Demandas (`demanda-chat.tsx`).
  - Portal do Cliente (`chat-cliente.tsx`).
  - Janelas flutuantes (`floating-chat-host.tsx`) — menu no header.
- Novo `EtiquetaPicker` (popover multi-seleção com cores + criação inline).
- Nova aba/filtro **Arquivadas** e chip de **Etiquetas** na sidebar da Central.
- Barra de pesquisa da Central passa a debounced + busca em mensagens; destaque do trecho encontrado.
- Renomear = edição inline do título da conversa (apelido pessoal, não altera o nome global).

### 4. Portal do Cliente
- Ícone de opções ao lado do chat com **Arquivar** e **Limpar histórico (para mim)**; sem exclusão global.

## Detalhes técnicos

```text
chat_gestao (usuario_id, chat_tipo, chat_id)  ── 1..n ── chat_etiqueta_vinculos ── n..1 ── chat_etiquetas
                     │
                     └── arquivado_em / excluido_em / apelido / pinado_em
```

- Full-text: coluna gerada `search_tsv tsvector` em cada tabela de mensagens + índice GIN.
- Feature flag não necessária — retrocompat via migração das tabelas `crm_chat_*`.
- Papéis: qualquer usuário arquiva/renomeia/etiqueta sua própria visão; excluir mensagens de outros exige `admin` (via `has_role`).
- Realtime: canal atual continua; nova subscription para `chat_gestao` do próprio usuário para refletir arquivamento em múltiplas abas.

## Fora de escopo
- Encaminhar mensagens, silenciar por período, exportar conversa (podem entrar depois).
- Reordenar etiquetas por drag-and-drop.

## Entregáveis
1. Migração SQL (tabelas + índices + RLS + tsvector + backfill das etiquetas do CRM).
2. `src/lib/chats/gestao.functions.ts` + atualização de `central.functions.ts`.
3. Componentes: `ConversaMenuAcoes`, `EtiquetaPicker`, `PesquisaConversas`.
4. Integração nos 5 pontos de chat citados + janela flutuante.
5. Verificação: `tsgo`, teste manual das ações em cada chat.
