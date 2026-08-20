# Etapa 18 — QA · Propostas & Kanban

## Achados & correções aplicadas

1. **`obterProposta`** — passou a ignorar propostas com `deleted_at` (não abrir ficha de proposta excluída).
2. **`atualizarDadosProposta`** — expandido o filtro de campos protegidos (`numero_proposta`, `deleted_*`, `homefin_*`, `created_at`, `updated_at`, `enviada_em`, `contrato_emitido_em`) e `WHERE deleted_at IS NULL`.
3. **`replicarProposta`** — `naoCopiar` agora exclui carimbos de sincronização, `numero_proposta_banco`, `ultimo_erro`, `etapas_banco`, `contrato_emitido_em` e flags de soft-delete, evitando “heranças” indevidas na cópia.

## Fluxos analisados

- **Nova Proposta**: `/operacional/propostas/enviar` (a partir de simulação) + `/operacional/propostas/nova` (direta, usa `useSimulacaoCompleta({ modoProposta: true })`).
- **Consulta / Minhas / Gerais / Excluídas**: `listarPropostas` com `escopo`, `q`, `data_inicio/fim`, `responsavel`, `apenas_excluidas`, paginação.
- **Visualização**: `obterProposta` retorna proposta + bancos (com `raw_response` da simulação para PDF detalhado) + envolvidos + documentos + follow-ups + histórico.
- **Edição**: `atualizarDadosProposta` só permite em `STATUS_EDITAVEIS` (`rascunho`, `aguardando_documentos`).
- **Cancelamento**: `cancelarProposta` valida `transicaoPermitida(_, 'cancelada')` + notifica banco via `cancelarPropostaHomefinImpl` em background (`waitUntil`).
- **Exclusão / restauração**: soft delete (`deleted_at/by/motivo`) com snapshot completo em `admin_audit_logs`; `restaurarProposta` limpa flags.
- **Envio ao banco** (`enviarPropostaImpl`): bloqueia sem `homefin_id_oportunidade`, sem cadastro complementar dos compradores (`envolvidoEnvioCompleto`), com documentos obrigatórios pendentes/reprovados; garante endereço via `garantirEnderecoParticipantes`; envio SEQUENCIAL por banco para evitar corrida na oportunidade; grava retorno (situação, taxa, parcela, número do banco) + reconciliação imediata via `sincronizarPropostaImpl`.
- **Reenvio**: `reenviarHomeFin = enviarPropostaHomeFin` reaproveita o mesmo endpoint; envio bloqueado em status terminais (`cancelada`, `credito_recusado`, `contrato_emitido`, `registrado`).
- **Sincronização automática**: (a) ficha faz polling silencioso a cada 60s + `refetchInterval` 30s do TanStack Query; (b) lista/kanban assinam realtime em `propostas`/`proposta_bancos`; (c) `/api/public/sync-propostas` roda em cron (pg_cron) até 200 propostas ativas por chamada, exige `apikey`.
- **Histórico**: `proposta_historico` recebe eventos `criada`, `enviada_ao_banco`, `erro_envio`, `sincronizacao`, `status`, `cancelada` (com `status_anterior/novo` e `ator_id`).
- **Anexos**: `registrarDocumento`, `removerDocumento`, `urlDocumento` (signed 5 min) em bucket `documentos-proposta`; edição bloqueada por `assertPropostaEditavel`.
- **Pendências / status**: `StatusBancosProposta` reflete o pior desfecho por linha de banco; `PropostaStatusBadge` na ficha; `pipeline-stepper` (12 etapas neutras) na ficha; `funil-banco-timeline` mostra as `etapas_banco` retornadas pela API.
- **Kanban**: `COLUNAS` agregam status legados; `moverStatusProposta` valida `transicaoPermitida` no servidor; UI recusa drop inválido com toast. Realtime + invalidação por `queryClient.invalidateQueries(['propostas'])` (debounced com rAF na lista).
- **Filtros / busca**: debounce 300ms no `q`; combos de responsável, corretor, imobiliária (usam `listarResponsaveisEquipe` + `listarParceiros`, com cache 5min); intervalo padrão = mês atual.
- **Parceiro vs Correspondente**: `/parceiro/propostas` faz `redirect → /operacional/propostas` — tela unificada com escopo restrito pela matriz de permissões (mem `portal-parceiro-unificado`).
- **Sincronização com Simulações**: `obterProposta` anexa `raw_response` do `simulacao_bancos` original em cada `proposta_bancos.raw_response ?? null`, sustentando o extrato detalhado.
- **Sincronização com Cliente**: `sincronizarEnvolvidoParaCliente` espelha os campos do envolvido para `clientes`/`cliente_enderecos` (só grava valores presentes, nunca apaga).
- **Sincronização com Documentos**: `enviarDocumentosBancoImpl` empurra os PDFs do CRM para a integração usando `homefin_id_simulacao_banco` do banco selecionado.
- **Sincronização com Financeiro**: trigger de `contrato_emitido` gera comissões automáticas (Etapa 06).
- **Sincronização com Relatórios**: `report_definitions` de propostas alimenta `runReport` (Etapa 08); soft-delete filtra corretamente porque as queries de relatório respeitam `deleted_at IS NULL`.

## Checklist de QA (aceite)

### Nova Proposta

- [ ] A partir de simulação simulada com ≥1 banco: origina proposta em `rascunho`, cria `proposta_bancos` (apenas o banco escolhido), preenche titular via `clientes`, e insere histórico `criada`.
- [ ] Tela `/operacional/propostas/nova` (direta): cria simulação + proposta na mesma jornada, seleciona bancos, respeita LTV/prazo/tipo de imóvel e confirmação de renda abaixo do sugerido.
- [ ] Não permite originar duas propostas da mesma simulação (marcador `proposta_existente_id`).

### Consulta / Minhas / Gerais / Excluídas

- [ ] Aba **Minhas** inclui propostas onde o usuário é responsável, criador ou parceiro do cliente (`cliente_parceiros`).
- [ ] Aba **Todas** respeita RLS por correspondente.
- [ ] Filtro `Responsável` só ativo em **Todas**, `Data`/`Busca`/`Grupo` funcionam em ambos.
- [ ] Aba **Excluídas** só aparece após toggle e mostra `nome_excluidor`, `deleted_at`, `deleted_motivo`.
- [ ] Debounce da busca ~300ms.
- [ ] Cards de grupo (Enviadas/Aprovadas/Recusadas/Canceladas) somam contagem e volume.

### Visualização / Edição

- [ ] Abrir proposta soft-deletada retorna erro amigável.
- [ ] Edição só habilita em `rascunho` e `aguardando_documentos`.
- [ ] `numero_proposta`, `deleted_*`, `homefin_*` **não** aceitam patch.
- [ ] Alteração de envolvido com `cliente_id` reflete no cadastro do cliente (nunca apaga campo pré-existente).

### Envio / Reenvio

- [ ] Bloqueia sem cadastro complementar dos compradores (COs/TIs).
- [ ] Bloqueia com documento obrigatório `pendente` ou `reprovado`.
- [ ] Bloqueia em status terminal (`cancelada`, `credito_recusado`, `contrato_emitido`, `registrado`).
- [ ] Envio SEQUENCIAL por banco (nunca paralelo) — a falha em um banco não impede os demais.
- [ ] Payload: `POST /oportunidade/{id}/incluir-proposta-integracao` com `idSimulacao = homefin_id_simulacao_banco`.
- [ ] Retorno grava `numero_proposta_banco` (número REAL, filtrando referências técnicas), `situacao_banco`, `taxa`, `parcela`, `prazo`, `IOF`.
- [ ] Após envio dispara `sincronizarPropostaImpl` (reconciliação imediata).
- [ ] Reenvio (`erro_envio` → `enviada_banco`) usa o mesmo endpoint e regrava carimbos.
- [ ] Auditoria registrada em `admin_audit_logs` (`proposta.enviar_banco`).

### Cancelamento / Exclusão

- [ ] `cancelarProposta` só a partir de status não terminais; grava `motivo_cancelamento`.
- [ ] Notificação de cancelamento ao banco em background (`waitUntil`), sem bloquear o usuário.
- [ ] `excluirProposta` grava snapshot completo em `admin_audit_logs` antes do soft delete.
- [ ] `restaurarProposta` limpa `deleted_at/by/motivo`.
- [ ] Se o cliente ficou órfão, `recuarEsteiraSeOrfao` recua a esteira CRM.

### Histórico / Anexos / Pendências

- [ ] `proposta_historico` recebe eventos consistentes (`criada`, `enviada_ao_banco`, `erro_envio`, `sincronizacao`, `status`, `cancelada`) com `ator_id`.
- [ ] Documentos obrigatórios pendentes/reprovados aparecem como pendência na aba **Enviar ao banco**.
- [ ] `urlDocumento` retorna signed URL válida por 5 min.

### Status / Kanban

- [ ] `PipelineStepper` reflete 12 etapas neutras; recusado destaca em `destructive`.
- [ ] `FunilBancoTimeline` mostra `etapas_banco` retornadas pela API.
- [ ] Kanban valida `transicaoPermitida` no cliente e re-valida no servidor (`moverStatusProposta`).
- [ ] Terminais (`cancelada`, `credito_recusado`, `contrato_emitido`, `registrado`) não são arrastáveis.
- [ ] Status legados são agregados nas colunas novas (documentação/vistoria/jurídico).
- [ ] Erros de transição inválida geram toast e não persistem.

### Filtros / Busca / Responsáveis / Auto-refresh

- [ ] Filtros de Corretor/Imobiliária listam todos os parceiros cadastrados + os já vinculados aos cards visíveis.
- [ ] Filtro de Responsável lista toda a equipe interna (mesmo sem proposta).
- [ ] Botão **Limpar** volta ao intervalo padrão (mês atual), escopo Minhas, sem grupo/filtro.
- [ ] Realtime: alteração feita por outro usuário reflete em <2s em lista e Kanban.
- [ ] Cron `/api/public/sync-propostas` (200 registros/execução) atualiza status sem clique manual; retorna `{ok, processadas, atualizadas, falhas}`.
- [ ] Ficha faz polling silencioso a cada 60s até chegar a status terminal.

### Sincronização com outros módulos

- [ ] Alterar dados do envolvido reflete em `clientes`/`cliente_enderecos`.
- [ ] `contrato_emitido` gera comissões (Etapa 06) e aparece em Relatórios Gerenciais (Etapa 08).
- [ ] Documentos aprovados no CRM aparecem para envio em **Enviar ao banco**.
- [ ] Soft-delete some da lista, Kanban e relatórios; aparece apenas em Excluídas.

### Parceiro vs Correspondente

- [ ] `/parceiro/propostas` redireciona para `/operacional/propostas`.
- [ ] Parceiro vê apenas propostas cujo cliente está vinculado a ele (`cliente_parceiros`), com mesma UI e mesmos controles do correspondente, exceto ações restritas pela matriz de permissões.
- [ ] Nenhum campo interno (responsável, correspondente, notas internas) vaza para o parceiro sem permissão explícita.
