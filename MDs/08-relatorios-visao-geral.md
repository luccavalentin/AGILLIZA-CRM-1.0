# Etapa 08 — Painéis de Monitoramento e Relatórios ERP

> Requer Etapas 03–07.

## Dependências e Produtos

**Depende de:** 00, 00b, **01** (RLS/`correspondente_id` para escopo de dados), **02** (shell), **03** (pipeline, clientes), **04** (`simulacoes`, `logs_integracao`), **05** (`propostas`, `proposta_status_historico`), **06** (`comissoes`, `contas_*`, `fluxo_caixa`), **07** (`tarefas`, `demandas`, `sla_regras`).
**Produz (consumido por 09, 10):**

- Views/materialized views agregadas por `correspondente_id`, banco, parceiro, período — reutilizadas pelo Portal do Parceiro (Etapa 10) com filtro adicional por `parceiro_id`.
- Componentes de painel e relatório reutilizáveis — o Portal do Parceiro (Etapa 10) reaproveita 100% para a visão restrita do parceiro.
- **Não cria tabelas de negócio** — apenas leitura.

## Objetivo

Consolidar a decisão gerencial em dois tipos de tela, com padrões visuais e componentes reutilizáveis distintos:

- **Painéis de monitoramento** (`/*/painel`): visão em tempo real do estado atual da operação. Poucas métricas, focadas, hierarquia forte.
- **Relatórios (`/relatorios/*`)**: análise gerencial completa em padrão ERP profissional. Filtros avançados, KPIs, seções de gráficos, tabela detalhada com totais no rodapé e exportação PDF/XLSX.

Painel ≠ Relatório. Painel responde "como estou agora?"; Relatório responde "o que aconteceu e por quê?".

---

## Parte 1 — Painéis de Monitoramento

### Regra número um: um painel = um foco

Cada painel responde a **uma pergunta principal**. Não repita KPIs do painel do módulo vizinho.

| Painel                | Pergunta principal                                   | KPIs hero (máx. 4)                                                                |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/visao-geral/painel` | Como está a produção comercial?                      | Simulações · Propostas enviadas · Taxa de aprovação · Contratos emitidos (com R$) |
| `/crm/painel`         | Como está a base ativa e a esteira?                  | Total de clientes · Novos no período · SLA vencido · Pendências críticas          |
| `/operacional/painel` | Como está a execução (propostas, demandas, tarefas)? | Simulações · Propostas · Aprovadas · Contratos                                    |
| `/financeiro/painel`  | Como está o fluxo?                                   | Total a pagar · Vencido · Pago no período · Saldo previsto 30d                    |

Depois dos 4 heros, **no máximo 6 mini-métricas** (linha única) e **1 gráfico principal** + **1–2 apoio**. Nada mais no fold. Se houver mais dado, vira relatório.

### Componentes canônicos (`src/components/common/dashboard.tsx`)

- `PanelHeader` — eyebrow (módulo · painel), título, descrição, chip de "Atualizado HH:mm", ações à direita (tabs de escopo + refresh + export).
- `PanelToolbar` — barra fina de filtros (período, escopo, busca de usuário).
- `SectionTitle` — separador entre grupos ("Indicadores executivos", "Volumes", "Operação").
- `HeroMetric` — número tabular grande (30px, monoespaçado), label micro em uppercase, hint em uma linha, barra lateral fina de tom. Sem "hero card" com gradiente colorido.
- `MiniMetric` — mesma linguagem, número 18px, para a linha de 6 secundárias.
- `PanelCard` — moldura padrão de gráfico/lista com título + subtítulo + link "Abrir".
- `MetricList` — lista kv com barra proporcional discreta (ranking de bancos, distribuição de SLA).
- `AlertRow` — item de alerta compacto (dot colorido + título + descrição + contador + link).

### Padrão visual ERP sóbrio (não negociável)

- Números **sempre** `font-mono tabular-nums`.
- Cor só como **status**: barra lateral de 2–3px + micro-chip. Sem cards com fundo colorido, sem gradientes, sem "hero card" chamativo.
- Densidade média. Espaçamento vertical de seção 20–24px; entre cards 12px.
- Ícones pequenos (`h-3.5 w-3.5`, `opacity-70`) — apoio, nunca protagonista.
- Cabeçalho da página: eyebrow `text-[11px] uppercase tracking-[0.16em]` + título 26px semibold + descrição 14px muted.
- SectionTitle com borda inferior fina e label `text-[11px] uppercase tracking-[0.14em]`.
- Modo escuro obrigatório e testado — tokens semânticos apenas (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`).

### Regras funcionais

1. **Escopo (`Tabs`)**: Minha · Equipe · Geral — respeitando `usuario_escopo_dados(uid, 'painel')`.
2. **Período (`Select`)**: hoje · 7d · 15d · 30d · este mês · mês anterior · este ano · custom. Default `mes`.
3. **Realtime**: uma subscrição `supabase.channel(...)` por painel, com invalidação estreita da queryKey de KPIs. Cleanup em `useEffect`.
4. **Server functions** por módulo: `get<Modulo>KPIs`, `get<Modulo>Graficos`, `get<Modulo>Alertas`, `get<Modulo>Ranking`. Cada uma protegida por `requireSupabaseAuth`.
5. **Loading**: skeletons no shape final (não spinner). `staleTime` 30s para KPIs.
6. **Empty state**: card com `CheckCircle2 text-emerald-500` + "Operação sem alertas críticos." Nunca linhas falsas para "parecer cheio".
7. **Ações rápidas**: rodapé com `Button variant="ghost"` linkando para o próximo passo mais provável — não como grid principal.

### Definition of Done — Painéis

- 4 heros + até 6 minis + 1 gráfico principal + 1 lista/ranking + alertas. Nada mais no fold.
- Tudo carrega em < 1s para 10k propostas.
- Layout responsivo em 375, 768, 1280 e 1440 sem overflow horizontal.
- Modo claro/escuro validados.
- Realtime funciona (marcar proposta como aprovada em outra aba muda o KPI aqui).

---

## Parte 2 — Relatórios ERP (`/relatorios/*`)

### Filosofia

Um relatório é um **documento executivo** que responde uma pergunta gerencial completa. Deve ser:

1. **Filtrável** — período, escopo, banco, produto, status, responsável, cliente, faixa de valor.
2. **Contextualizado** — mostrar acima do detalhamento os indicadores agregados do que está sendo listado.
3. **Detalhado** — tabela completa com todas as colunas relevantes, ordenação, busca, totais no rodapé.
4. **Exportável** — PDF (com cabeçalho institucional) e XLSX (com colunas formatadas), respeitando mascaramento de PII.
5. **Auditável** — cada export grava `report_audit_logs` com filtros e usuário.
6. **Imprimível** — botão "Imprimir" com CSS `@media print` que esconde toolbar/filters e mantém tabela + KPIs.

### Estrutura obrigatória de todo relatório

```
┌─────────────────────────────────────────────────────────────────┐
│  RELATÓRIOS · <MÓDULO>                                          │
│  <Título executivo>                          [Escopo] [Export]  │
│  <Descrição em 1 linha>                      [PDF] [XLSX] [🖨]  │
│  Período: X · Escopo: Y · Registros: Z                          │
├─────────────────────────────────────────────────────────────────┤
│  [Filtros: período, banco, status, usuário, cliente, ...]       │
├─────────────────────────────────────────────────────────────────┤
│  INDICADORES                                                     │
│  [KPI] [KPI] [KPI] [KPI] [KPI] [KPI]                            │
├─────────────────────────────────────────────────────────────────┤
│  ANÁLISE                                                         │
│  [gráfico principal]     [gráfico apoio 1]  [gráfico apoio 2]   │
├─────────────────────────────────────────────────────────────────┤
│  RANKING / DISTRIBUIÇÃO                                          │
│  [tabela agrupada, se aplicável — ex.: por banco, por usuário]  │
├─────────────────────────────────────────────────────────────────┤
│  DETALHAMENTO — N registros                                      │
│  [DrilldownTable com totais no rodapé]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes canônicos (`src/components/reports/*`)

- `ReportShell` — cabeçalho executivo com eyebrow, título, descrição, meta (período · escopo · registros), botão Imprimir automático.
- `ReportSection` — separador semântico entre seções ("Indicadores", "Análise", "Ranking", "Detalhamento").
- `ReportFiltersBar` — barra de filtros com Período (obrigatório) + Mais filtros (dropdown) + Limpar. Filtros ativos aparecem como chips com `X` para remover.
- `VisionSelector` — Minha · Equipe · Geral respeitando `can_view_team_reports` / `can_view_global_reports`.
- `ReportKpiCard` — sóbrio, número monoespaçado, sem caixa de ícone colorida. Barra lateral 2px de tom + ícone discreto.
- `ChartCard` — moldura padrão de gráfico (título + subtítulo + ação opcional).
- `DrilldownTable` — busca rápida, ordenação por coluna, paginação, alinhamento por coluna (direita para números), **rodapé de totais** por coluna (`footer: 'sum' | 'count' | 'avg' | fn`), zebra em linhas ímpares, cabeçalho sticky.
- `ExportButtons` — PDF (via `report-pdf.ts`) + XLSX (via `report-xlsx.ts`). Registra em `report_exports` e `report_audit_logs`.
- `GenericReportPage` — página completa que combina tudo acima. **Todo relatório de módulo consome esse componente.**

### Rotas obrigatórias (não reduzir)

`painel-geral`, `consolidado`, `comerciais`, `simulacoes`, `propostas`, `crm`, `clientes`, `demandas`, `tarefas`, `financeiros`, `comissoes`, `app-cliente`, `operacionais`, `exportacoes`, `personalizados`.

### KPIs por relatório (mínimo obrigatório)

- **Painel Geral / Consolidado**: 6 KPIs (Clientes, Simulações, Propostas, Aprovadas, Contratos, Volume contratado) + funil + ranking de bancos + evolução mensal.
- **Comerciais**: Propostas, Taxa de aprovação, Ticket médio, Valor contratado, Contratos, Banco líder + série mensal + top 10 usuários.
- **Simulações**: Total, Rápidas, Completas, Erro, Conversão sim→prop, Ticket médio simulado.
- **Propostas**: Total, Em análise, Aprovadas, Recusadas, Contratos, Docs pendentes + distribuição por banco.
- **Financeiros**: A receber, A pagar, Pago, Recebido, Saldo previsto, Vencido + fluxo mensal + top devedores/credores.
- **Comissões**: Comissão prevista, Comissão paga, Comissão vencida, Ticket médio comissão + ranking por responsável.
- **CRM / Clientes**: Total, Novos, Ativos, Incompletos, App habilitado, Sem responsável.
- **Demandas / Tarefas**: Abertas, Atrasadas, Concluídas, SLA vencido, Tempo médio, Top responsáveis.
- **App Cliente**: Habilitados, Ativos 7d, Ativos 30d, Docs enviados, Mensagens novas.

### Regras críticas

1. **Escopo**: `can_view_global_reports` / `can_view_team_reports` (funções SQL existentes) definem se vê tudo, equipe ou próprio. Padrão: `minha`.
2. **PII**: se usuário não tem `pii:view`, CPF/CNPJ/renda vão **mascarados** na tela, no XLSX e no PDF (`mask_pii_jsonb` no server).
3. **Cache**: server function usa `cache-control` 60s para views agregadas; invalidar por evento (proposta mudou de status ⇒ `queryClient.invalidateQueries`).
4. **Auditoria**: toda export grava `report_audit_logs` com filtros usados, contagem, usuário, timestamp.
5. **Agendamento por e-mail**: fora do escopo (não temos provedor de e-mail no sistema). Export fica no `/relatorios/exportacoes` para download manual.
6. **Filtros na URL**: cada relatório serializa filtros na query string para link compartilhável.
7. **Rodapé de totais**: obrigatório em toda coluna numérica (soma, média ou contagem, conforme o negócio). Não deixar total ausente.
8. **Sem "tela vazia bonita"**: se não há dado, mostra `EmptyReport` com filtros sugeridos para ampliar o período.

### Padrão visual ERP (relatórios)

- Mesma linguagem sóbria dos painéis: números monoespaçados, cores só como status, barras laterais finas.
- Tabelas com **zebra** (`bg-muted/25` nas ímpares), **cabeçalho sticky**, **borda 2px acima do rodapé de totais**, `text-right tabular-nums` em colunas numéricas.
- Rodapé de totais com fundo `bg-muted/60`, `font-semibold`, label "TOTAIS" em uppercase micro à esquerda.
- Impressão: CSS `@media print` esconde toolbar/filters/`.print:hidden`; título, KPIs e tabela ocupam a página com margem confortável e cores mantidas para PDF fiel.
- PDF exportado: cabeçalho azul `#000F9F`, tabela zebrada `#F7F8FA/#FFFFFF`, títulos grafite `#0B0B0F`. Ignora o tema do usuário.

### `/relatorios/personalizados`

Constructor: usuário escolhe view base + colunas + filtros + tipo de gráfico. Salva em `report_saved_filters` (`private` ou `shared_team`). Executa via `runReport`. Compartilhamento respeita permissão do escopo.

### `/relatorios/exportacoes`

Histórico de exports (`report_exports`) com status, formato, filtros aplicados (JSON legível), botão de re-download (se ainda existe no bucket) ou de reexecução com os mesmos filtros.

---

## Estrutura de dados

- `report_definitions`, `report_saved_filters`, `report_exports`, `report_audit_logs`.
- Views: `vw_reports_dashboard_general`, `vw_reports_bank_performance`, `vw_reports_user_performance`, `vw_reports_clients_summary`, `vw_reports_simulations_summary`, `vw_reports_proposals_summary`, `vw_reports_demands_summary`, `vw_reports_tasks_summary`, `vw_reports_financial_summary`. Todas `security_invoker` (respeitam RLS do usuário).

## Definition of Done — Relatórios

- Toda rota de relatório consome `ReportShell` (não reimplementar header).
- Toda tabela detalhada tem rodapé de totais preenchido.
- Botões Imprimir + PDF + XLSX funcionam em todo relatório.
- Analista com escopo `proprios` só vê seus dados em qualquer relatório.
- Export PDF/XLSX preserva formatação e respeita mascaramento de PII.
- Filtros persistem via query string (compartilhável).
- Painel geral carrega em < 1s para 10k propostas.
- Modo claro/escuro testados em cada relatório.
- Impressão respeita `@media print` (sem toolbar, tabela cabe na página A4 landscape).
