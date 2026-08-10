# Etapa 06 — Financeiro: Contas a Pagar, Contas a Receber, Comissões, Fluxo de Caixa

> Requer Etapas 01, 03, 05.

## Dependências e Produtos
**Depende de:** 00, 00b, **01** (papéis: `financeiro`, `correspondente`), **03** (`clientes`, parceiros oriundos de `/admin/pessoas`), **05** (evento `proposta.status='contrato_emitido'` que dispara a comissão).
**Produz (consumido por 08, 10):**
- Tabelas: `contas_pagar`, `contas_receber`, `comissoes` (com `proposta_id`, `parceiro_id`, `percentual`, `valor`), `fluxo_caixa`, `categorias_financeiras`.
- Trigger `on_proposta_contrato_emitido` → cria `comissoes` a receber (banco → correspondente) e a pagar (correspondente → corretor/imobiliária) conforme regras da parceria (definidas na Etapa 10).
- KPIs financeiros — lidos pelos painéis de monitoramento e relatórios ERP da Etapa 08.


## Objetivo
Controlar caixa da correspondente: pagar fornecedores/parceiros, receber comissões do banco e repassar aos corretores/imobiliárias, e apresentar KPIs financeiros. Todo lançamento tem numeração, aprovação, baixa/estorno rastreados.

## O que o módulo faz
1. Ao `proposta.status='contrato_emitido'`, dispara **cálculo automático da comissão** via `comissao_regras` (banco × produto × valor faixa × % parceiro × % interno) e cria:
   - Conta a **receber** do banco (valor bruto da comissão).
   - Conta a **pagar** ao parceiro (split parceiro).
2. CRUD de **contas a pagar** (fornecedores, cartório, marketing, salários, impostos).
3. CRUD de **contas a receber** (comissões, taxas de serviço, outras).
4. **Baixa** com data de pagamento, forma, comprovante (upload em `financeiro-comprovantes`).
5. **Estorno** com motivo obrigatório; reverte impacto no fluxo de caixa.
6. **Fluxo de caixa** projetado (30/60/90 dias) e realizado (por mês).
7. Categorias, centros de custo, formas de pagamento configuráveis.

## Telas
### `/financeiro/painel`
KPIs: A receber hoje / 30d, A pagar hoje / 30d, Saldo projetado, Inadimplência (>10 dias vencido).
Gráficos: receita vs. despesa por mês (últimos 12), receita por banco, despesa por categoria.

### `/financeiro/contas-a-pagar` e `/contas-a-receber`
Tabela: número, descrição, fornecedor/pagador, categoria, centro de custo, vencimento, valor, status (aberta/parcial/paga/atrasada/cancelada), ações.
Filtros: status, período, categoria, centro, fornecedor.
Ações em linha: baixar, editar, cancelar, ver detalhes.
Botão “Nova conta” abre dialog: descrição, valor, vencimento, categoria, CC, fornecedor, anexo, recorrência (mensal/anual).

### Drawer de detalhe
Timeline de eventos (`financial_payable_history`), abas: Dados, Anexos, Baixas, Estornos.

### `/financeiro/comissoes`
Lista de comissões calculadas: proposta, banco, valor bruto, split parceiro, split interno, status (a receber, recebida, paga parceiro, encerrada).
Botão “Recalcular” (recomputa por `comissao_regras`).

### `/financeiro/fluxo-de-caixa`
Projeção diária/semanal/mensal.

### `/financeiro/relatorios`
Ver Etapa 08.

## Estrutura de dados
- `financial_payables` (35 colunas): usar existente.
- `financial_receivables` (criar se ausente, mesma estrutura).
- `financial_payable_history`, `financial_audit_logs`.
- `financial_categories`, `financial_cost_centers`, `financial_payment_methods` — CRUD admin.
- `comissao_regras`: banco, produto, faixa valor min/max, tipo (percentual/fixo), valor, % parceiro, % interno, vigência.

## Regras críticas
1. **Cálculo automático**: hook em `propostas UPDATE WHERE status='contrato_emitido'` chama `calcularComissao(proposta_id)`.
2. **Estorno gera nova linha** (não deleta a original); marca original `estornada`.
3. **Baixa parcial** possível; status vira `parcial` até quitação total.
4. **Auditoria**: toda ação em finance grava `financial_audit_logs` (obrigatório LGPD/SOX-like).
5. **Permissões**: `financeiro.contas_pagar/receber:view/create/edit/approve/baixar/estornar`. Escopo `todos` para gestor/finance; outros só `view` da própria comissão.
6. Recorrência gera próximas ocorrências automaticamente (job diário).

## Definition of Done
- Contrato emitido → conta a receber + conta a pagar parceiro criadas com valores corretos.
- Baixar conta com anexo funciona.
- Estornar reverte KPI.
- Analista/comercial só vê suas próprias comissões.
- Testes: cálculo por faixa, estorno, baixa parcial, recorrência.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **KPIs do painel financeiro** (`ReportKpiCard`)
  - "A receber" → tone `success`, ícone `TrendingUp`.
  - "A pagar" → tone `warning`, ícone `Wallet`.
  - "Saldo projetado" → tone `brand` (primary), ícone `LineChart`.
  - "Inadimplência" → tone `danger`, ícone `AlertTriangle`.
- **Tabela de contas** (a pagar/a receber): cabeçalho `bg-muted text-muted-foreground text-xs uppercase tracking-wide`; zebra `even:bg-muted/40` (light) / `even:bg-muted/60` (dark); valores em `tabular-nums text-right`.
- **Status da conta** (`<StatusBadge>`):
  - `paga`/`recebida` → tone `success`.
  - `aberta` → tone `info`.
  - `parcial` → tone `warning`.
  - `atrasada` → tone `danger`.
  - `cancelada`/`estornada` → tone `muted`.
- **Botão "Nova conta"**: `variant="default"`. Botão "Baixar"/"Confirmar recebimento": `variant="default"` no drawer. Botão "Estornar"/"Cancelar": `variant="destructive"` — obriga preencher motivo.
- **Fluxo de caixa** (gráfico): receita em `var(--chart-3)` (verde), despesa em `var(--chart-5)` (vermelho), saldo projetado em `var(--chart-1)` (azul primário). Barras horizontais com `tabular-nums` no eixo Y.
- **Comprovante anexado**: preview em card com `border-dashed border-border`; ícone `Paperclip text-muted-foreground`.
