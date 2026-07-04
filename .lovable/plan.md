## Objetivo

Resolver os problemas relatados na ficha do cliente, nas listagens e no Scan IA.

> Importante: a sessão do Supabase expirou. As partes de banco (migração + reordenar esteira) só rodam após reconectar o Supabase no painel. As partes de frontend não dependem disso.

---

## 1. "Habilitar acesso" ao portal não salva → cliente sempre "Inativo"

Hoje o interruptor no formulário só muda estado local e nunca grava; e ficava desabilitado. O badge "Inativo/Ativo" lê `portal_acesso_ativo`, que nunca muda.

- Criar server function `definirAcessoPortal({ cliente_id, ativo })` que atualiza `clientes.portal_acesso_ativo` (com `requireSupabaseAuth` + escopo).
- No `ClienteForm`, ligar o `Switch` a essa função (salvar ao alternar, com toast). Em cadastro novo, manter desabilitado até existir id.
- Invalidar `["cliente", id]` para o badge atualizar na hora.

## 2. "Nova simulação personalizada" desabilitada

Botão está fixo como `disabled`. A Etapa 04 já existe.

- Trocar por `Link` para a tela de nova simulação com o cliente pré-selecionado (`?cliente=<id>`).
- A tela de nova simulação lê esse parâmetro e pré-preenche o cliente.

## 3. Ordem da esteira (bug já identificado antes)

Reaplicar o reordenamento interrompido: `cadastro_completo`→2, `simulacao`→3, `aprovacao`→4, para um cliente recém-cadastrado não mostrar Simulação/Aprovação como concluídas. (migração de dados)

## 4. Filtro por data na Esteira e nas Simulações

- Esteira (`crm.painel.tsx`): filtro De/Até pela data de atualização/entrada na etapa, em search params.
- Simulações (`operacional.simulacoes.tsx`): mesmo filtro por `created_at`, em search params, aplicado na server function de listagem.

## 5. Nova aba "Vínculo de atendimento" na ficha do cliente

- **Responsável**: quem criou/está responsável (`clientes.responsavel_id`/criador) — leitura.
- **Parceiros vinculados**: usa a tabela existente `cliente_parceiros`. Adicionar/remover vínculos escolhendo entre usuários/parceiros cadastrados (lista com escopo do correspondente).
- Server functions: `listarVinculosCliente`, `vincularParceiro`, `desvincularParceiro`, `listarParceirosDisponiveis`.
- Componente `src/components/crm/vinculo-tab.tsx`.

## 6. Scan IA — autor, exclusão e auditoria

- Nas telas `crm.scan-ia.tsx` (lista) e `crm.scan-ia_.$id.tsx` (detalhe): exibir o **usuário que criou** cada leitura (join com `profiles` pelo criador/`ator_id`) e a data.
- Adicionar ação **Excluir** (com confirmação, reusando `confirm-delete`).
- Toda exclusão (e criação) grava em `scan_ia_auditoria` (`acao`, `ator_id`, `leitura_id`, `dados`) — nenhum registro some sem trilha.
- Server functions: `excluirLeituraScan` (soft/hard delete + insert em auditoria) e ajuste das listagens para trazer o autor.

### Detalhes técnicos

- Server functions novas em `src/lib/crm/*.functions.ts` (padrão `createServerFn` + `requireSupabaseAuth`).
- Filtros por data via `validateSearch` (zod + `fallback`) e queryKey/loaderDeps.
- RLS de `cliente_parceiros` e `scan_ia_auditoria` validadas; ajuste por migração se faltar insert/delete pelo correspondente.
- Sem alterações no back-end de comunicação com a API bancária.

### Pergunta em aberto

Em "vincular parceiros ... simulação ou aprovação": confirmo que o vínculo é só associar usuários/parceiros ao cliente (visibilidade/atendimento), sem alterar regras de comissão. Se a intenção for definir quem recebe comissão, trato como bloco adicional depois.
