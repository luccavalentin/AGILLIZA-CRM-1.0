## Objetivo

Refazer o módulo **Demandas** do zero (UI), mantendo a camada de servidor sólida que já existe. O foco é uma tela clara onde o usuário **vê a demanda que recebeu/enviou** e **conversa em tempo real** sobre ela, podendo vincular **cliente**, **proposta** ou **simulação**. Remover ruído (abas Sistema/Arquivos/Anexos/Histórico soltos, KPIs poluídos, filtros de vínculos que não pertencem à demanda).

## Escopo e permissões (padrão do sistema)

- **Minhas**: onde o usuário é **criador** ou **responsável** ou **participante**.
- **Gerais**: todas do correspondente que a RLS já libera para o papel (mesma regra do resto do sistema).
- **Kanban** e **Lista** respeitam o mesmo toggle `Minhas / Gerais`, persistido em `localStorage`.
- Ações por papel (já existe no `obterDemanda`):
  - Criador: editar, excluir, transferir, mover status, comentar.
  - Responsável: editar, transferir, mover status, comentar.
  - Participante: comentar, mover status.

## Estrutura de arquivos

### Server (pequenos ajustes)

- `src/lib/operacional/demandas.functions.ts`
  - `listarDemandas`: aceitar `escopo: "minhas" | "geral"`. Em `"minhas"` filtrar via `.or(criador_id.eq.<uid>,responsavel_id.eq.<uid>)` + união com participantes. Trazer `proposta_id`, `simulacao_id`, contagem de mensagens não lidas.
  - `criarDemanda`: aceitar `proposta_id` e `simulacao_id` opcionais.
  - `editarDemanda`: aceitar troca de `cliente_id`, `proposta_id`, `simulacao_id`.
  - Nova: `listarPropostasOpcoes({ cliente_id? })` e `listarSimulacoesOpcoes({ cliente_id? })` para os seletores.

### Migration

```text
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS proposta_id  uuid REFERENCES public.propostas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS simulacao_id uuid REFERENCES public.simulacoes(id) ON DELETE SET NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
```

### UI reescrita

- `src/routes/_authenticated/operacional.demandas.tsx` — **lista limpa**
  - Header: título + botão "Nova demanda".
  - Toggle **Minhas / Gerais** (Tabs).
  - Busca por título/número + filtro de Status e Prioridade (nada de analista/corretor/imobiliária/comercial).
  - 4 KPI compactos: **Abertas · Em andamento · Vencendo em 24h · Atrasadas**.
  - Cards em grid (2/3 colunas): número + título, cliente vinculado (se houver), avatar do responsável e criador ("de → para"), badge de prioridade e status, SLA (dias restantes/atraso), **badge de mensagens não lidas**.
  - Click → detalhe. Menu do card: editar, transferir, excluir (conforme papel).

- `src/routes/_authenticated/operacional.demandas_.kanban.tsx` — **kanban enxuto**
  - Mesmo toggle Minhas/Gerais.
  - 5 colunas (aberta, em andamento, aguardando, concluída, cancelada).
  - Card idêntico ao da lista (compacto). Drag persiste via `moverStatusDemanda`.
  - Botão "Criar demanda" no rodapé de cada coluna.

- `src/routes/_authenticated/operacional.demandas_.$id.tsx` — **painel único com chat lateral**
  - Layout 2 colunas em ≥ md; empilha no mobile.
  - **Coluna esquerda (resumo)**: título + número, badges (status, prioridade, SLA), **de → para**, descrição, vínculos (cliente, proposta, simulação) como chips clicáveis que abrem a ficha correspondente. Ações por papel: mover status, transferir, editar, excluir. Timeline de eventos (transferência/edição/status) em card retrátil.
  - **Coluna direita (chat)**: conversa em tempo real (`demanda_mensagens` via realtime), bolhas com autor+timestamp, campo de mensagem com Enter=enviar / Shift+Enter=quebrar linha. Som de novo recado usando `useIncomingChatSound`. Marca lida ao abrir (`marcarDemandaLida`). **Sem** aba de arquivos/sistema — só resumo + timeline + chat.
  - Remove por completo `demanda_anexos` da UI de detalhe (mantemos a coluna no banco para compat; a UI de anexos vai embora — pedido explícito do usuário).

- `src/components/operacional/nova-demanda-dialog.tsx` — **enxuto**
  - Campos: Título*, Descrição, Prioridade (P1/P2/P3), Responsável* (colegas), Cliente (combo com busca), Proposta (combo — filtra pelo cliente selecionado, se houver), Simulação (idem).
  - **Sem** upload de arquivos, sem "dados de simulação" em campo separado, sem tipo (fica como `diversos`).
  - Envio único chama `criarDemanda` com os vínculos.

- `src/components/operacional/transferir-dialog.tsx` — mantém, é usado no detalhe.

## Chat em tempo real (detalhe)

- `useEffect` subscreve `supabase.channel('demanda-msgs-<id>')` em `postgres_changes` na tabela `demanda_mensagens` filtrando por `demanda_id=eq.<id>`.
- Ao chegar INSERT → refetch da conversa + som + rolagem ao fim.
- `comentarDemanda` já existe; o input chama com `{ demanda_id, corpo }`.

## Fluxo de permissões (defesa em profundidade)

- **RLS** já garante `SELECT/INSERT/UPDATE/DELETE` corretos em `demandas` e filhas.
- **Server fns** revalidam papel em cada mutação (já existe em `papelNaDemanda`).
- **UI** só exibe botões conforme `permissoes` retornado por `obterDemanda`.

## Fora de escopo (não mexer)

- Server layer de SLA/notificações (RPCs `demanda_escalar_vencidas`, `emitir_notificacao`) — já ok.
- Página `/relatorios/demandas` — reaproveita `listarDemandas`.

## Definition of Done

- Toggle Minhas/Gerais funcional na lista e no kanban.
- Card mostra número, cliente, criador → responsável, prioridade, status, SLA e badge de não lidas.
- Criar demanda com cliente+proposta+simulação vinculados salva corretamente.
- Detalhe abre com 2 colunas (resumo + chat), realtime funcionando entre dois navegadores.
- Sem UI de anexos, sem abas "Sistema/Arquivos", sem filtros de analista/corretor/imobiliária.
- Ações restritas por papel (verifica no BE e esconde no FE).
- Build + tsc limpos.
