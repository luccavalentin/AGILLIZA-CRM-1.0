# Etapa 06 — Financeiro 2.0: A Pagar, A Receber, Comissões, Repasses, Fluxo de Caixa, Integração com RH

> Requer 01, 03, 05, 10. Interage com Etapa 11 (RH — dia de pagamento gera CP automático).

## 1. Escopo

**Tabelas**:

- `financial_payables` (31 col.) — Contas a Pagar, com `origem_tipo` e `origem_ref` (idempotência com folha/comissão).
- `financial_receivables` (31 col.) — Contas a Receber.
- `financial_payable_history` — timeline de eventos.
- `comissoes` (19 col.) — banco → correspondente (auto-criada em `contrato_emitido`).
- `comissoes_usuario` (19 col.) — correspondente → time (repasses configurados).
- `comissao_regras` (16 col.) e `comissao_regras_usuario` (16 col.) — regras por banco × produto × faixa × %.
- `fluxo_caixa` (10 col.) — visão consolidada.
- `financial_categories`, `financial_cost_centers`, `financial_payment_methods`.
- `financial_audit_logs`.

**Server fns** em `src/lib/financeiro/`:

- `financeiro.functions.ts`: CRUD `financial_payables/receivables`, `baixarConta`, `estornarConta`, `listarFluxoCaixa`.
- `comissoes-usuario.functions.ts`: `configurarRepasse`, `inferirTipoVinculo`, `recalcularComissoesUsuario`.
- `format.ts` — utilitários de formatação BR robustos (nunca crashar em NaN/null).

**Trigger `on_proposta_contrato_emitido`** — cria automaticamente:

1. `financial_receivables` (banco → correspondente) com base em `comissao_regras`.
2. `financial_payables` (correspondente → parceiro) com split conforme `parceiro_detalhes.percentual`.
3. `comissoes_usuario` para cada regra ativa em `comissao_regras_usuario` (com o usuário responsável + banco).

## 2. Rotas

### `/financeiro/painel`

KPIs (`ReportKpiCard`): A receber hoje/30d, A pagar hoje/30d, Saldo projetado, Inadimplência (>10d vencido). Gráficos: receita vs. despesa 12 meses, receita por banco, despesa por categoria. Empty state real.

### `/financeiro/contas-a-pagar` e `/contas-a-receber`

Tabela densa: número, descrição, favorecido/pagador, categoria, CC, vencimento, valor (`tabular-nums`), status, ações inline (baixar, editar, cancelar, ver detalhes). Filtros: status (aberta/parcial/paga/atrasada/cancelada/estornada), período, categoria, CC, favorecido. Botão "Nova conta" abre dialog com recorrência (mensal/anual). Drawer de detalhe com timeline em `financial_payable_history`.

Componentes reutilizáveis extraídos em `src/components/financeiro/contas/`.

### `/financeiro/comissoes` (banco → correspondente)

Lista automática. Colunas: proposta (PRO), banco, valor bruto, split parceiro, split interno, status (`a_receber`, `recebida`, `paga_parceiro`, `encerrada`). Botão "Recalcular" recomputa por `comissao_regras`.

### `/financeiro/comissoes-usuario` (repasses correspondente → time — **novo em 2.0**)

Configuração de % por usuário/banco (ou como % sobre o split da comissão principal). Gatilhos disponíveis: **Contrato emitido** e **Manual** (removidos gatilhos não realizáveis). Usuários selecionáveis via `ComboSelect` (input+pesquisa); tipo de vínculo (Corretor/Comercial/Gestor etc.) é inferido automaticamente por `inferirTipoVinculo` do papel do usuário.

### `/financeiro/fluxo-de-caixa`

Projeção diária/semanal/mensal com KPIs reconstruídos + gráfico consolidado. Compreende `financial_payables` + `financial_receivables` + comissões pendentes.

### `/financeiro/configuracoes`

CRUD de categorias, centros de custo, formas de pagamento.

## 3. Bucket

`financeiro-comprovantes` (privado) — anexos de baixa/estorno. Signed URL 5min.

## 4. Regras críticas

1. **Cálculo automático** de comissão em `on_proposta_contrato_emitido` — bate com `comissao_regras`.
2. **Estorno gera nova linha** (não deleta original); marca original `estornada`. Motivo obrigatório.
3. **Baixa parcial** possível; status vira `parcial` até quitação total.
4. **Recorrência** gera próximas ocorrências em job diário.
5. **Auditoria** em `financial_audit_logs` para toda ação (LGPD/controle interno).
6. **Papel `financeiro`** com escopo `todos` no módulo; outros papéis só veem próprias comissões (via RLS + `crm_usuario_pode_ver_dado_financeiro`).
7. **Deletados não entram em KPI/fluxo** — filtro global.
8. **Integração com RH (2.0)**: quando `rh_funcionarios.gerar_contas_pagar_automatico=true`, server fn `gerarContasPagarSalarios(competencia)` cria `financial_payables` idempotente por `(funcionario_id, competencia)` via `origem_tipo='rh_folha'` e `origem_ref`. Vencimento = próximo dia útil ≥ `dia_pagamento_salario` (default 5). Adiantamentos marcados "pagar via financeiro" viram linhas separadas.

## 5. Aparência

- KPIs: A receber `success`, A pagar `warning`, Saldo `brand`, Inadimplência `danger`.
- Tabela com zebra + cabeçalho sticky + rodapé de totais (`bg-muted/60 font-semibold`).
- Status via `<StatusBadge>` (paga/recebida→success; aberta→info; parcial→warning; atrasada/estornada→danger; cancelada→muted).
- Botão "Nova conta"/"Baixar"/"Confirmar recebimento": `variant="default"`. "Estornar"/"Cancelar": `variant="destructive"` com motivo obrigatório.
- Fluxo de caixa: receita `chart-3` verde, despesa `chart-5` vermelho, saldo `chart-1` azul.
- Números sempre `tabular-nums text-right` em colunas numéricas.

## 6. Definition of Done

- Contrato emitido → conta a receber + conta a pagar parceiro + `comissoes_usuario` criadas corretamente.
- Baixa parcial funciona; status vira `parcial`.
- Estorno cria nova linha, reverte KPI.
- Recorrência gera próxima ocorrência no job.
- Analista/comercial só vê próprias comissões (RLS).
- Repasses: mudar % → aplicar em próximos contratos; recalcular retroativo funciona.
- RH: funcionário com toggle ligado gera CP no dia 5 (idempotente).
- Papel `financeiro` acessa `/financeiro/*` completo; outros só onde a matriz permite.
- Testes: cálculo por faixa, estorno, baixa parcial, recorrência, idempotência RH→CP.
