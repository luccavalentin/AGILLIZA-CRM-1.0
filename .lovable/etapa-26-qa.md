# Etapa 26 — QA: Financeiro

## Escopo do módulo
- **Painel** (`/financeiro/painel`) — KPIs (a receber/pagar hoje/30d, saldo projetado, inadimplência, receita×despesa 12m).
- **Contas a Pagar** (`/financeiro/contas-a-pagar`) — CRUD, baixa, estorno, cancelamento, exclusão, histórico, auditoria.
- **Contas a Receber** (`/financeiro/contas-a-receber`) — mesmo fluxo.
- **Fluxo de Caixa** (`/financeiro/fluxo-de-caixa`) — projetado + realizado, granularidade dia/semana/mês, cobertura, runway, próximos vencimentos.
- **Comissões** (`/financeiro/comissoes`) — trigger `on_proposta_contrato_emitido` chama `calcular_comissao_proposta` + `calcular_comissoes_usuario_proposta`; gera CR (banco→correspondente) e CP (repasse parceiro).
- **Comissões por Usuário** (`/financeiro/comissoes-usuario`) — regras por usuário/banco/produto.
- **Configurações** (`/financeiro/configuracoes`) — categorias, centros de custo, formas de pagamento, regras de comissão.
- **Relatórios Financeiros** (`/relatorios/financeiros`).

## Correções aplicadas
1. **`baixarConta`** — bloqueia baixa se conta já `paga`; valida `valor <= saldo devedor + tolerância` (elimina overpay).
2. **`cancelarConta`** — bloqueia cancelamento quando `valor_pago > 0` (exige estorno primeiro; evita perda silenciosa de histórico).
3. **`excluirConta`** — dupla trava por `correspondente_id`, bloqueia exclusão com pagamentos e grava `financial_audit_logs` (`excluida`).
4. **`atualizarConfig` / `excluirConfig`** — dupla trava por `correspondente_id` (evita cross-tenant se RLS for afrouxada).

## Checklist QA

### Painel Financeiro
- [x] KPIs a receber/pagar (hoje e 30d) somam apenas contas `aberta`/`parcial`; usa `valor - valor_pago`.
- [x] Saldo projetado = a receber 30d − a pagar 30d.
- [x] Inadimplência = a receber com vencimento < hoje-10d.
- [x] Receita×Despesa mensal (12m) usa `data_pagamento` (realizado).
- [x] Cap 50 000 linhas para evitar corte silencioso em 1 000.
- [ ] **Backlog** — migrar KPIs para `sum()`/RPC quando volume passar de ~50k contas em aberto.

### Contas a Pagar / Receber
- [x] Filtros: status (aberta/parcial/paga/atrasada/cancelada/estornada), categoria, CC, contraparte, período.
- [x] "Atrasada" é derivado: `status in (aberta,parcial) AND vencimento < hoje`.
- [x] Paginação (max 100/pág) com `count: exact`.
- [x] Criação avulsa + parcelada (2..360 parcelas, centavos absorvidos na última).
- [x] Recorrência mensal/anual/nenhuma persistida em `recorrencia`.
- [x] Baixa total/parcial → `valor_pago`, `status`, `aprovado_por`/`aprovado_em`, lança em `fluxo_caixa` (realizado).
- [x] Baixa bloqueada em `paga/cancelada/estornada` e valida saldo devedor.
- [x] Estorno cria linha reversa (`estorno_de`) + lançamento no fluxo, mantém original com `estornada=true`.
- [x] Cancelamento exige motivo e sem pagamentos.
- [x] Exclusão exige sem pagamentos e grava auditoria.
- [x] Histórico por conta (`financial_payable_history`).
- [x] Auditoria em `financial_audit_logs` para todas as ações.
- [ ] **Backlog** — recorrência "mensal"/"anual" hoje é apenas rótulo (não gera parcelas futuras automaticamente). Se necessário, cron `pg_cron` para materializar as próximas ocorrências.

### Fluxo de Caixa
- [x] Granularidade dia/semana/mês.
- [x] Analítico com projetado (vencimento contas em aberto) + realizado (`fluxo_caixa`).
- [x] Saldo acumulado, média entrada/saída, melhor/pior período.
- [x] Cobertura = entrada proj / saída proj × 100.
- [x] Runway = saldo final proj / média saída.
- [x] Próximos vencimentos (10) ordenados a partir de hoje.
- [x] Entradas por banco / Saídas por categoria.

### Comissões
- [x] Trigger `on_proposta_contrato_emitido` cria comissão + CR + CP (split parceiro).
- [x] Regra escolhida por `correspondente + produto + banco + faixa` (ordem: produto>banco>faixa).
- [x] `recalcularComissao` remove CR/CP em aberto vinculados e chama `calcular_comissao_proposta` de novo.
- [x] Comissões por usuário (níveis: admin/gestor/comercial/analista/parceiro) via `comissao_regras_usuario` + `comissoes_usuario`.
- [x] Auditoria: `financial_audit_logs` action=`calculada`/`recalculada`.
- [ ] **Backlog** — hoje `listarComissoes` não filtra por `correspondente_id` (RLS cobre). Reforço defensivo pendente.

### Configurações
- [x] CRUD de categorias (receita/despesa), CC e formas de pagamento.
- [x] Exclusão gracioso: se houver FK ativa, faz `ativo=false` em vez de erro.
- [x] Dupla trava por correspondente (aplicada nesta etapa).
- [x] Regras de comissão (`comissao_regras`) por faixa/produto/banco/vigência.

### Relacionamentos
- [x] Proposta ↔ Comissão (`comissoes.proposta_id`).
- [x] CR ↔ Comissão (`financial_receivables.comissao_id`); CP ↔ Comissão (`financial_payables.comissao_id`).
- [x] Parceiro ↔ CP (`financial_payables.parceiro_id`).
- [x] Banco ↔ CR (`financial_receivables.banco_nome`).
- [x] Usuário criador (`criador_id`) e aprovador (`aprovado_por`).
- [x] Cliente ↔ proposta ↔ comissão (via cadeia).

### Permissões / Paridade Correspondente × Parceiro
- [x] `usuario_pode_financeiro` (admin/correspondente/gestor/financeiro) controla o menu.
- [x] RLS por `correspondente_id` em todas as tabelas financeiras.
- [x] Escopo por permissão (view/create/edit/delete) via `usuario_tem_permissao('financeiro.*', ...)`.
- [x] Parceiro externo NÃO vê o menu Financeiro por padrão (nav-config gate). Se admin liberar, vê apenas seus repasses (via `parceiro_id` em CP).
- [x] Comissões por usuário respeitam RLS por `user_id` do próprio.

### Integrações externas
- [x] Não há integração externa direta no Financeiro (nem gateway de pagamento nem conciliação bancária).
- [ ] **Backlog** — conciliação por OFX/CNAB, boleto/Pix cobrança, e integração com contabilidade não estão no escopo atual.

### Auditoria
- [x] `financial_audit_logs` grava criada, baixada, estornada, cancelada, excluída (agora), calculada, recalculada.
- [x] Payload JSON com valor/motivo/quitada.
- [x] `financial_payable_history` para trilha por conta.

### Anexos / Exportações
- [x] `comprovante_path` em `financial_payables`/`financial_receivables` (Storage).
- [x] Exportação PDF/XLSX via engine de relatórios (`relatorios.financeiros`).

### Igualdade visual Correspondente × Parceiro
- [x] Mesmas telas do shell autenticado — parceiro só vê o menu se admin liberar via matriz de permissões; conteúdo respeita RLS/escopo.

### Itens N/A
- [N/A] Aprovação em duas etapas (workflow multi-nível) — não solicitado; hoje `aprovado_por` = quem baixou.
- [N/A] Contas bancárias como entidade separada — hoje representadas via `financial_payment_methods`.
