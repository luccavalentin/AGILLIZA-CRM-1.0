# Etapa 27 — QA: Relatório Gerencial

## Escopo

- Rota `/relatorios/gerencial` (`ReportView codigo="gerencial"`).
- Server fn central `runReport` em `src/lib/relatorios/reports.functions.ts` (função `relGerencial`).
- Componentes visuais em `src/components/reports/*` (KPIs, Charts, Tabelas, Filtros, Export).

## Correções aplicadas

- **`perfisUsuarios`** — considera `tipos_pessoa` (array) além de `tipo_pessoa` primário, priorizando `imobiliaria`/`corretor` para separar corretamente parceiros multi-tipo nas seções "Por Imobiliária" e "Por Corretor" (antes, um parceiro com `tipos_pessoa=['imobiliaria']` mas `tipo_pessoa='corretor'` era classificado errado).

## Checklist QA

### KPIs

- [x] Simulações, Volume simulado, Propostas, Em andamento, Aprovadas, Crédito recusado, Contratos emitidos, Valor contratado.
- [x] Crédito aprovado NÃO inclui contratos (evita dupla contagem).
- [x] Valor contratado usa `valor_financiamento_aprovado` com fallback para `valor_financiamento` e `imovel_valor` (cliente).

### Cards / Gráficos

- [x] Funil: Simulações → Propostas → Em andamento → Aprovadas → Recusadas → Contratos.
- [x] Distribuição por banco (top 10, ativos + histórico).
- [x] Contratos por banco (top 8 por valor).
- [x] Comparativo mensal (6 meses) anexado a todos os relatórios via `comparativoMensalPropostas`.

### Tabelas (Rankings / Agrupamentos)

- [x] Seção **Simulações**: Por data, Por banco, Por tipo (Financ./Home Equity), Por status, Por analista Adm, Por analista Comercial, Por Imobiliária, Por Corretor.
- [x] Seção **Processos em andamento**: Por valor · banco, Por tipo, Por analista Adm, Por Comercial × banco, Por Imobiliária, Por Corretor, Por fase (status atual).
- [x] Seção **Propostas aprovadas**: Por data, Por banco, Por tipo, Por analista Adm × banco, Por Comercial × banco, Por Imobiliária, Por Corretor.
- [x] Seção **Crédito recusado**: idem estrutura de aprovadas.
- [x] Seção **Contratos emitidos**: Por data de emissão, Por banco, Por tipo, Por analista Adm × banco, Por Comercial × banco, Por Imobiliária, Por Corretor + linha "Por valor · banco".
- [x] Totalizações (footer `sum`) em Qtd e Valor de todas as tabelas.
- [x] Ordenação padrão: valor desc dentro de cada grupo (agrupamento 2D usa k1 asc + valor desc).

### Filtros

- [x] Período: hoje, 7d, 15d, 30d, mês, mês anterior, ano, custom (`resolverIntervalo`).
- [x] Escopo: minha / equipe / geral (respeita `usuario_escopo_dados('relatorios.geral')` via RLS + `aplicarEscopo`).
- [x] Banco (single + multi `bancos[]`), Produto, Status, Responsável, Cliente, Busca textual, ValorMin/Max.
- [x] Multi-seleção pessoa: `analistas[]`, `comerciais[]`, `corretores[]`, `imobiliarias[]` (OR intra-grupo, AND entre grupos) via `aplicarFiltrosPessoa`.
- [x] Filtro por Status oculta transientes técnicos (`enviada_banco`, `registrado`, `erro_envio`) via `STATUS_PROPOSTA_OCULTOS`.
- [x] Contratos emitidos: filtragem por período em `contrato_emitido_em` (via cliente) para pegar contratos cuja proposta foi criada fora do período.

### Períodos / Comparações

- [x] Data-limite superior expandida para `T23:59:59` (não perde registros do último dia).
- [x] Comparativo mensal (6 meses) com quantidade, taxa de aprovação (`aprovada / decididas`) e distribuição por banco (top 8).

### Drill-down

- [x] Tabela principal `rows` lista até 1000 linhas (Simulações + Propostas ativas + Contratos), com origem, número, banco, cliente, produto, fase, analista, comercial, imobiliária, corretor, valor, criada em.
- [x] `DrilldownTable` permite ordenação client-side por coluna e paginação client-side.
- [x] `PainelDrilldownDialog` abre detalhamento por KPI/gráfico nos painéis (link para o relatório correspondente).

### Exportação PDF

- [x] `report-pdf.ts` (jsPDF + autoTable) — vertical/A4, cabeçalho, KPIs, gráficos (canvas), tabelas com footer, comparativo mensal.
- [x] `registrarExport` grava em `report_exports` + auditoria em `report_audit_logs` (`acao=exportou`).

### Exportação XLSX

- [x] `report-xlsx.ts` (xlsx) — uma aba por seção (KPIs, tabelas), formatação numérica pt-BR.
- [x] Mesma trilha de auditoria via `registrarExport`.

### Impressão

- [x] `report-shell.tsx` inclui classe `print:` do Tailwind e chama `window.print()` no botão Imprimir; layout otimizado A4 retrato.

### Atualização / Paginação / Ordenação

- [x] Botão "Atualizar" re-executa `runReport` (invalida cache TanStack Query).
- [x] Paginação client-side em `DrilldownTable` (limit 1000 no servidor cobre o SLO 12 meses × operações típicas).
- [x] Ordenação client-side por coluna com toggle asc/desc.

### Responsividade

- [x] Grid de KPIs colapsa 4→2→1 colunas (`sm/md/lg`).
- [x] `report-filters-bar` vira acordeão em telas < md.
- [x] Tabelas com scroll horizontal em mobile; cards de gráfico ocupam largura total.

### Permissões / Escopo

- [x] Menu Relatórios gated por `usuario_tem_permissao('relatorios.*', 'view')`.
- [x] Escopo "geral" gated por `can_view_global_reports`; "equipe" por `can_view_team_reports`; "minha" por default.
- [x] RLS em `propostas`, `simulacoes`, `clientes`, `comissoes`, `demandas`, `tasks` já restringe cross-tenant e cross-usuário (aplicarEscopo é reforço).
- [x] Registros com `deleted_at` são ignorados via `TEM_SOFT_DELETE` em `fetchAll`.
- [x] Auditoria de visualização em `report_audit_logs` (`acao=visualizou`) com filtros aplicados.
- [x] PII (documento/renda/data_nasc) mascarada quando `temPii === false`.

### Usuários visíveis no filtro

- [x] `listarPessoas` retorna profiles ativos (`ativo != false`) do correspondente, ordenados por nome, com bucket por `tipos_pessoa` (analistas, comerciais, corretores, imobiliárias) + `todos` para Responsável.
- [x] Multi-tipo suportado — parceiro com `tipos_pessoa=['imobiliaria','comercial']` aparece nos dois filtros.
- [x] Nomes de responsáveis nas linhas resolvidos via `nomesUsuarios` (batch por IDs) para evitar N+1.

### Cobertura por entidade

- [x] **Simulações** — via `fetchSimulacoesRelatorio` + enriquecimento com `simulacao_bancos`.
- [x] **Propostas em andamento** — status `enviada_banco`, `em_analise_credito`, `aguardando_documentos`, `credito_aprovado`, `engenharia_vistoria`, `analise_juridica`.
- [x] **Propostas aprovadas** — status `credito_aprovado` (sem contratos).
- [x] **Contratos emitidos** — coleta via `clientes.contrato_emitido_em` no período + join com `propostas` e `proposta_bancos`.
- [x] **Bancos** — via `proposta_bancos` + fallback `nome_banco` da proposta; múltiplos bancos por proposta preservados (`bancos_label`).
- [x] **Tipos de operação / Produtos** — `financiamento_imobiliario` / `home_equity` via `PRODUTO_LABEL`.
- [x] **Analista Adm / Comercial / Parceiros / Imobiliária / Corretor** — via `analista_id`, `comercial_id`, `parceiro_id` na proposta + `tipos_pessoa` para separar Imob × Corretor.
- [x] **Responsáveis** — `usuario_responsavel_id`.
- [x] **Fases / Status** — via rótulos oficiais (`STATUS_PROPOSTA_LABEL`, `STATUS_SIMULACAO_LABEL`).
- [x] **Clientes / Demandas / Tarefas / Documentos / SLAs / Contas a pagar/receber / Comissões / Repasses / Resultados financeiros** — cobertos pelos relatórios irmãos (`clientes`, `demandas`, `tarefas`, `financeiros`, `comissoes`) que compartilham o mesmo engine e filtros.

### Compatibilidade com módulos de origem

- [x] Contratos emitidos consultam `clientes.contrato_emitido_em`, mesma fonte usada no CRM/Painel para o KPI "Contrato emitido".
- [x] Valores usam `valor_financiamento_aprovado` (idem financeiro/comissões).
- [x] Status filtrados batem com os rótulos oficiais em `components/propostas/status.ts`.
- [x] Nome do banco = mesmo consumido em `homefin_bancos` + `proposta_bancos` (visto em `listarOpcoesOperacionais`).

### Paridade Correspondente × Parceiro

- [x] Mesmo shell autenticado, mesma rota `/relatorios/gerencial`, mesmos componentes visuais.
- [x] Parceiro só vê Relatórios se `permissions` liberar `relatorios.*`. Se liberado, escopo "geral"/"equipe" cai para "minha" salvo se `can_view_*_reports` retornar `true`.
- [x] Dropdown de responsáveis para parceiro é limitado por RLS de `profiles` (visão de equipe apenas quando autorizado).

## Backlog identificado (não bloqueante)

- [ ] Migrar carga do Comparativo Mensal para RPC agregando no banco (hoje traz até 20 000 linhas de propostas). Ganhos > 100k propostas/6m.
- [ ] Server-side pagination + sort por coluna do `DrilldownTable` (hoje é 1000 linhas client-side).
- [ ] Impressão dedicada com quebra manual por seção (`page-break-inside: avoid`) para PDFs grandes.
- [ ] Persistência de "meus filtros" por relatório (`report_saved_filters` já existe; UI ainda expõe apenas em Personalizados).

## Itens N/A

- [N/A] Contratos ao vivo do banco — o sistema não recebe webhook; contrato_emitido é evento interno.
- [N/A] Cache/CDN — Relatórios são sempre live via `runReport` (invalidam por sessão).
