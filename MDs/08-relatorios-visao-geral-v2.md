# Etapa 08 — Painéis + Relatórios ERP Avançados 2.0

> Requer 03–07, 11 (RH). Este documento é a fonte da verdade dos relatórios do sistema.

## 1. Filosofia (dois tipos de tela)

- **Painel** (`/*/painel`) — "como estou agora?". Real-time. Um foco. Máx 4 heros + 6 mini + 1 gráfico principal + alertas.
- **Relatório** (`/relatorios/*`) — "o que aconteceu e por quê?". Filtrável, exportável, imprimível, auditável.

## 2. Engine única `runReport`

Todos os 18 relatórios do sistema consomem a mesma engine + componentes.

**Server fn `runReport(codigo, filtros, escopo)`** em `src/lib/relatorios/`:
- Recebe `codigo` (ex.: `comerciais`, `simulacoes`, `propostas`, `financeiros`, `crm`, `clientes`, `demandas`, `tarefas`, `comissoes`, `app-cliente`, `operacional`, `consolidado`, `gerencial`, `rh`, `matriculas`, `personalizados`, `painel-geral`, `exportacoes`).
- Recebe `filtros`: `{periodo:{de,ate}, escopo:'minha'|'equipe'|'geral', banco?, produto?, status?, responsavel?, cliente?, faixa_valor?, uf?, categoria?, cost_center?}` — todos serializados em query string para link compartilhável.
- Retorna `{ kpis: KpiDef[], graficos: ChartDef[], ranking?: RankingDef, detalhamento: { colunas, linhas, totais } }`.
- Respeita `can_view_global_reports` / `can_view_team_reports` + PII masking se sem `pii:view`.
- Cacheia views agregadas por 60s; invalida por evento (proposta mudou status → `queryClient.invalidateQueries(['relatorios'])`).

Componentes canônicos (`src/components/reports/`):
- `ReportShell` — cabeçalho executivo (eyebrow · título · descrição · meta com período/escopo/registros · botão Imprimir).
- `ReportSection` — separador semântico.
- `ReportFiltersBar` — Período (obrigatório) + Mais filtros (dropdown) + chips ativos + Limpar.
- `VisionSelector` — Minha · Equipe · Geral.
- `ReportKpiCard` — número monoespaçado + label micro + barra lateral 2px do tone + ícone discreto.
- `ChartCard` — moldura padrão de gráfico.
- `DrilldownTable` — busca rápida, ordenação, paginação, alinhamento por coluna, **rodapé de totais obrigatório** por coluna numérica.
- `ExportButtons` — PDF + XLSX; registra em `report_exports` + `report_audit_logs`.
- `ReportView` — página completa que combina tudo.

Estrutura visual obrigatória:
```
┌───────────────────────────────────────────────────────────────┐
│ RELATÓRIOS · <MÓDULO>                                         │
│ <Título>                              [Escopo] [PDF][XLSX][🖨]│
│ Período: X · Escopo: Y · Registros: Z                         │
├───────────────────────────────────────────────────────────────┤
│ [Filtros: Período · Banco · Status · Usuário · Cliente · +]   │
├───────────────────────────────────────────────────────────────┤
│ INDICADORES  [KPI][KPI][KPI][KPI][KPI][KPI]                   │
├───────────────────────────────────────────────────────────────┤
│ ANÁLISE  [gráfico principal] [apoio 1] [apoio 2]              │
├───────────────────────────────────────────────────────────────┤
│ RANKING / DISTRIBUIÇÃO  [tabela agrupada]                     │
├───────────────────────────────────────────────────────────────┤
│ DETALHAMENTO — N registros                                    │
│ [DrilldownTable com rodapé de totais]                         │
└───────────────────────────────────────────────────────────────┘
```

## 3. Rotas ativas (18 recortes — todas usando `ReportView`)

- `/relatorios` — hub com cards de cada recorte + últimos exports.
- `/relatorios/painel-geral` — visão de topo (6 KPIs + funil + ranking bancos + evolução mensal).
- `/relatorios/consolidado` — todos os módulos, filtros globais banco + status.
- `/relatorios/comerciais` — Propostas, Taxa de aprovação, Ticket médio, Valor contratado, Contratos, Banco líder + série mensal + top 10 usuários. Com filtro banco.
- `/relatorios/simulacoes` — Total, Rápidas, Completas, Erro, Conversão sim→prop, Ticket médio.
- `/relatorios/propostas` — Total, Em análise, Aprovadas, Recusadas, Contratos, Docs pendentes + distribuição por banco.
- `/relatorios/crm` — funil da esteira, tempo médio por etapa, gargalos.
- `/relatorios/clientes` — Total, Novos, Ativos, Incompletos, App habilitado, Sem responsável.
- `/relatorios/demandas` — Abertas, Atrasadas, Concluídas, SLA vencido, Tempo médio, Top responsáveis. Filtro status.
- `/relatorios/tarefas` — idem.
- `/relatorios/financeiros` — A receber, A pagar, Pago, Recebido, Saldo previsto, Vencido + fluxo mensal + top devedores/credores.
- `/relatorios/comissoes` — Comissão prevista, paga, vencida, Ticket médio + ranking por responsável.
- `/relatorios/app-cliente` — Habilitados, Ativos 7d/30d, Docs enviados, Mensagens novas.
- `/relatorios/operacional` — Simulações vs Propostas vs Contratos, tempo entre etapas.
- `/relatorios/gerencial` — visão executiva do correspondente (inclui **Home Equity** e financiamento em recortes separados). Se comunica com todos os módulos.
- `/relatorios/rh` — Funcionários ativos, em experiência, aniversariantes 30d, férias em curso/vencidas/vencendo, absenteísmo, custo folha por mês, top salários (com PII masking).
- `/relatorios/matriculas` — Solicitações, créditos consumidos, top solicitantes.
- `/relatorios/personalizados` — constructor (view base + colunas + filtros + gráfico) salvo em `report_saved_filters` (`private|shared_team`).
- `/relatorios/exportacoes` — histórico de exports com status, filtros aplicados, botão re-download / reexecutar.

## 4. Painéis (`/*/painel`)

- `/visao-geral/painel` — Simulações · Propostas · Taxa de aprovação · Contratos + gráfico + alertas críticos.
- `/crm/painel` — Total clientes · Novos · SLA vencido · Pendências + esteira funil + alertas.
- `/operacional/painel` — Simulações · Propostas · Aprovadas · Contratos + fila de propostas por SLA + alertas.
- `/financeiro/painel` — A pagar · Vencido · Pago no período · Saldo 30d + fluxo + top devedores.
- `/rh/index` (nova) — Funcionários ativos · Em experiência · Aniversariantes · Férias em curso + próximos vencimentos de docs.

## 5. Segurança avançada (2.0 — reforço)

1. **RLS aplicada em toda view agregada** — todas com `security_invoker=on` (respeitam o escopo do usuário).
2. **PII masking automático** em relatórios se usuário sem `pii:view` — vale na tela, XLSX e PDF exportados.
3. **Auditoria obrigatória** em `report_audit_logs` para todo export (usuário, formato, filtros JSON, contagem de linhas, timestamp, IP).
4. **Rate-limit** em exports: máx 10/hora/usuário; PDF grande (>500 linhas) processado em job assíncrono, com aviso "seu relatório está pronto" no sino.
5. **Assinatura visual** no PDF: marca d'água diagonal + rodapé com "Emitido por {nome} em {data}" + hash SHA-256 dos filtros aplicados (evita adulteração).
6. **Filtros persistem via query string** para link compartilhável; o token de compartilhamento respeita o escopo do usuário que abre (não do que gerou).
7. **Cache invalidado por evento** (proposta muda → `queryClient.invalidateQueries(['relatorios'])`).
8. **Modo público de report** (por link) — **desabilitado por padrão**; se habilitado por admin, link expira em 24h e não expõe PII.

## 6. Export PDF / XLSX

- **PDF** (`src/lib/relatorios/report-pdf.ts`, jsPDF + autotable, **portrait** por padrão, landscape para relatórios com >8 colunas):
  - Cabeçalho azul `#000F9F` com logo Agilliza + ecossistema (razão social).
  - KPIs em cards + gráficos renderizados como imagem (via canvas → dataURL).
  - Tabela zebrada `#F7F8FA/#FFFFFF`, cabeçalho sticky, rodapé de totais destacado.
  - Marca d'água diagonal cinza claro "AGILLIZA — CONFIDENCIAL".
  - Rodapé com data emissão + usuário + `pág X/N` + hash filtros.
  - Ignora tema do usuário (sempre light).
- **XLSX** (`src/lib/relatorios/report-xlsx.ts`):
  - Aba 1: Filtros aplicados.
  - Aba 2: KPIs.
  - Aba 3: Detalhamento (formatação BR de números/datas, congela cabeçalho, negrito no rodapé de totais).
  - Aba 4: Ranking (quando aplicável).
- Nome do arquivo: `{codigo}_{correspondente}_{periodo}_{ts}.pdf|xlsx`.

## 7. Padrão visual ERP (obrigatório)

- Números em `font-mono tabular-nums`.
- Cor só como status: barra lateral 2–3px + micro-chip. Sem card colorido, sem gradiente.
- Densidade média; espaçamento vertical 20–24px entre seções.
- Ícones pequenos e discretos (`h-3.5 w-3.5 opacity-70`).
- Cabeçalho: eyebrow `text-[11px] uppercase tracking-[0.16em]` + título 26px semibold + descrição 14px muted.
- Zebra `bg-muted/25` em linhas ímpares; cabeçalho sticky; rodapé com borda 2px acima + `bg-muted/60 font-semibold` + label "TOTAIS" uppercase micro à esquerda.
- Print (`@media print`): esconde toolbar/filters; título, KPIs e tabela ocupam A4.
- Modo claro/escuro validados na tela; PDF/XLSX sempre light.

## 8. Definition of Done

- Todas as 18 rotas montam via `ReportView`/`ReportShell` (não reimplementar header).
- Toda coluna numérica tem rodapé de totais.
- Imprimir + PDF + XLSX funcionam em todos.
- Escopo `proprios` respeitado em todos os relatórios.
- PII mascarada na tela, no XLSX e no PDF quando aplicável.
- Filtros persistem via query string.
- Painel geral <1s para 10k propostas.
- Modo claro e escuro validados por relatório.
- Impressão A4 landscape para relatórios largos, portrait para painéis.
- Export loga em `report_audit_logs` com filtros.
- Constructor de personalizados salva e recarrega corretamente.
- Cache invalida quando dado muda (testar: mudar status de proposta → relatório de propostas reflete em <5s).
