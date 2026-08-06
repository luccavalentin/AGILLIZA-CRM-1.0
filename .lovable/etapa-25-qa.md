# Etapa 25 — QA: Controle de Matrículas

## Escopo real do módulo
O módulo **Controle de Matrículas** (`/matriculas`) é um **controle financeiro** das compras/reembolsos de matrículas do correspondente:

- **Config Pix** (`matricula_config`) — chave e titular.
- **Créditos** (`matricula_creditos`) — compras de crédito para uso em cartórios.
- **Solicitações** (`matricula_solicitacoes`) — cada pedido de matrícula (solicitante, corretor, cliente, nº matrícula, valor, reembolso, observação).
- **Totais consolidados** — total_creditos, total_gasto, total_reembolsado, total_a_reembolsar, saldo.

**Não é** um repositório documental de matrículas de imóveis (upload PDF, cartório, comarca, ônus, averbações, versionamento, validade, vinculação a proposta/imóvel/processo). Esses itens ficam como **backlog** — recomenda-se implementar no módulo **Documentos** (`arquivos_nos`) com categoria "Matrícula" + metadata estruturada, ou como nova feature no CRM Imóvel.

## Correções aplicadas
- **Escopo por correspondente** em todas as mutações (`excluir/atualizar/alternar` de créditos e solicitações) — RLS já protegia, mas agora há dupla trava server-side com `eq("correspondente_id", corr)`.
- Consulta de `atual` no `atualizarSolicitacaoMatricula` também filtra por `correspondente_id`, evitando `single()` cruzar tenants em caso de bypass de RLS.

## Checklist QA

### Cadastro / Config Pix
- [x] Chave e titular Pix salvos (upsert por `correspondente_id`).
- [x] Faixa Pix exibida no topo (`PixBanner`).
- [x] Validação de tamanho (max 200).

### Créditos
- [x] Registro de crédito (data, valor, descrição, criado_por).
- [x] Exclusão escopada.
- [x] Ordenação por data desc.
- [x] Total consolidado somado no server.

### Solicitações
- [x] Campos: data_solicitacao, solicitante, corretor, cliente, numero_matricula, valor, reembolsado, data_pagto_reembolso, observacao.
- [x] Autocomplete de solicitante/corretor via `listarUsuariosCorrespondente` (exclui parceiros externos).
- [x] Alternar reembolso rápido (grava `reembolsado_em`).
- [x] Edição preserva `reembolsado_em` se já reembolsado.
- [x] Exclusão escopada.

### Consolidação
- [x] Totais: créditos, gasto, reembolsado, a reembolsar, saldo.
- [x] Um único server fn (`obterControleMatriculas`) para hidratar a tela.

### Permissões
- [x] `requireSupabaseAuth` em todos os endpoints.
- [x] Filtro `correspondente_id` server-side + RLS.
- [x] `listarUsuariosCorrespondente` exclui `corretor` e `imobiliaria` (parceiros).

### Paridade Correspondente x Parceiro
- [x] Rota `/matriculas` acessível apenas conforme matriz de permissões (nav-config). Parceiro externo não vê o menu.

### Auditoria
- [ ] **Backlog** — hoje não grava em `admin_audit_logs` alterações de créditos/solicitações. Recomendação: chamar `registrar_auditoria` em criar/editar/excluir.

### Itens N/A neste módulo (backlog — Documentos/CRM Imóvel)
- [N/A] Upload do PDF da matrícula, cartório, comarca, cidade, estado, proprietários, dados do imóvel, ônus, averbações.
- [N/A] Validade / data de emissão / vencimento / alertas de expiração.
- [N/A] Status (pendente/analisada/aprovada/reprovada), pendências, análise, versionamento.
- [N/A] Vinculação estruturada a cliente/proposta/imóvel/processo (hoje o link é textual: campos `cliente` e `numero_matricula`).
- [N/A] Reflexo na análise do imóvel e nos relatórios (não há entidade "matrícula do imóvel" para consolidar).

## Recomendação
Se o objetivo for **gestão documental completa** da matrícula do imóvel, abrir feature dedicada:

1. Nova tabela `matriculas_imovel` (numero, cartorio, comarca, cidade, uf, emitida_em, valida_ate, status, cliente_id, proposta_id, imovel_id, storage_path, versao, ativa).
2. Trigger para versionamento (nova versão = `ativa=false` na anterior).
3. Alertas via `notificacoes` quando `valida_ate` < 90/60/30 dias.
4. Aba "Matrículas" na ficha da proposta puxando por `proposta_id`.
5. Auditoria via `registrar_auditoria`.

Manter o módulo atual como **Controle Financeiro de Matrículas** (nome já apropriado).
