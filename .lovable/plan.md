# Módulo — Gestão de Pessoas e RH

Escopo grande (15 subtelas, 13+ tabelas, integração bidirecional com Financeiro). Vou entregar em **5 fases incrementais**, cada uma funcional e navegável, sem quebrar o que já existe. A rota placeholder `/rh` já existe e será substituída pelo módulo real.

## Arquitetura reaproveitada (sem duplicar nada)

- **Rotas**: `src/routes/_authenticated/rh.*.tsx` (padrão dot-nested, como `crm.*` e `financeiro.*`).
- **Server functions**: `src/lib/rh/*.functions.ts` com `createServerFn` + `requireSupabaseAuth` (padrão de `pessoas.functions.ts`).
- **Componentes**: usar `Card`, `Table`, `Dialog`, `ComboSelect`, `date-input`, `PainelView`, `ReportsView`, `ReportFiltersBar`, `GerenciadorArquivos`, `StatusBadge`, `ReportKpiCard` — nada novo estilizado à parte.
- **Permissões**: adicionar módulo `rh.*` em `CATALOGO_MODULOS` (`src/lib/admin/regras-modulos.functions.ts`) com ações `view/create/edit/delete/export` e escopo (`todos/equipe/proprios/personalizado`). `filterNavByPermissions` já pega automático.
- **RLS**: todas as tabelas com `correspondente_id`, políticas usando `usuario_tem_permissao('rh.*', ...)` + `usuario_escopo_inclui_dono`. Grants padrão.
- **Auditoria**: `registrar_auditoria` existente (`entidade='rh.*'`). Aparece automaticamente em `/admin/auditoria` — só adiciono os labels amigáveis no mapa da tela.
- **Anexos**: bucket privado novo `rh-documentos` seguindo padrão dos existentes.
- **Notificações in-app**: `emitir_notificacao` para docs vencendo, férias aprovadas, competência fechada.
- **Integração financeira**: adicionar colunas `rh_origem jsonb` + `rh_funcionario_id uuid` em `financial_payables` e `financial_receivables` (não altera telas atuais — colunas opcionais). Ao fechar competência → gera lançamentos com `rh_origem`. Trigger em `financial_payables.status='paga'` marca `rh_competencia_pagamentos.status`.
- **PDFs / XLSX**: `report-pdf.ts`, `report-xlsx.ts`, `export-pdf.ts` já existentes.
- **Design**: tokens semânticos + `#000F9F`, dark+light. Sem novo componente visual.

## Fase 1 — Base + Funcionários (primeira entrega)

Migração cria:
- `rh_cargos`, `rh_departamentos` (referência do tenant).
- `rh_funcionarios` (dados pessoais, profissionais, bancários, jornada, status, admissão, cargo, depto, gestor_id, salário atual).
- `rh_dependentes`.
- `rh_funcionario_historico` (append-only via trigger em UPDATE).
- Sequência `rh_funcionario_seq` → `FUN-000001`.
- Índices + Grants + RLS + policies.
- Adição de `rh.*` em `CATALOGO_MODULOS`.
- Item no menu lateral "Gestão de Pessoas e RH" com os 15 subitens (só os da Fase 1 já funcionais — os demais aparecem com placeholder "Em breve" nativo, igual outros módulos, até a fase correspondente).

Telas:
- `/rh` → **Dashboard** com KPIs (ativos/afastados/férias/experiência/docs pendentes/vencidos/faltas mês/atestados) e gráficos (recharts).
- `/rh/funcionarios` → lista (busca, filtros status/cargo/depto, cards no mobile / tabela no desktop, export PDF).
- `/rh/funcionarios/novo` → wizard 4 passos (Pessoais → Profissionais → Bancários → Dependentes).
- `/rh/funcionarios/$id` → ficha em tabs (Resumo, Dependentes, Documentos, Benefícios, Férias, Ocorrências, Holerites, Histórico, Auditoria). Tabs da Fase 2+ ficam com empty state até chegar.

## Fase 2 — Documentos + Faltas/Ocorrências + Atestados

- `rh_documentos` (categoria, storage_path, validade, situação; alerta por vencimento).
- `rh_ocorrencias` (falta/atraso/saída antecipada/hora extra/advertência/suspensão/ausência just./ausência injust./folga/outro; `impacta_folha`, competência, doc anexo).
- Atestado = ocorrência tipo `atestado` com CID e dias.
- Telas: `/rh/documentos`, `/rh/faltas-ocorrencias`, `/rh/atestados`.
- Cron `api/public/rh-cron` diário → marca docs próximos do vencimento e emite notificação.

## Fase 3 — Férias + Benefícios + Alterações Salariais

- `rh_ferias` (aquisitivo, concessivo, saldo, solicitação, aprovação, programação, aviso, recibo).
- `rh_beneficios` (catálogo do tenant) + `rh_funcionario_beneficios` (vínculo com valor/período).
- `rh_alteracoes_salariais` (histórico imutável, motivo, documento, responsável).
- Telas correspondentes.

## Fase 4 — Adiantamentos + Descontos + Prévia da Folha + Integração Financeira

- `rh_adiantamentos` (valor, parcelas, competência, situação).
- `rh_descontos` (avulsos por competência).
- `rh_competencias` (mês/ano, status aberta/fechada, fechada_em/por).
- `/rh/adiantamentos`, `/rh/descontos`, `/rh/alteracoes-salariais`, `/rh/previa-folha`.
- **Fechar competência** → gera `financial_payables` (salários, benefícios, adiantamentos líquidos, previsão de férias) com `rh_origem = {tipo, funcionario_id, competencia}` e `rh_funcionario_id`. Ressarcimentos → `financial_receivables`. Baixa da conta atualiza `rh_competencia_pagamentos.status` via trigger. Aviso obrigatório: "Prévia — cálculo oficial fica com a contabilidade".

## Fase 5 — Holerites + Relatórios + Configurações + Auditoria

- `rh_holerites` (holerite/recibo/férias/rescisão anexados por funcionário/competência).
- `/rh/holerites`, `/rh/relatorios`, `/rh/configuracoes` (cargos, deptos, catálogo de benefícios, regras de alerta).
- Relatórios reutilizam `ReportsView` + engine `runReport` + `report_definitions` (Funcionários, Documentação, Benefícios, Férias, Faltas, Ocorrências, Adiantamentos, Descontos, Holerites, Custos com pessoal, Prévia). Export PDF/XLSX já pronto.
- Labels amigáveis das entidades `rh.*` em `/admin/auditoria`.

## Confirmações antes de começar

1. **Faseamento**: aceita entregar em 5 fases (Fase 1 já agora, próximas conforme você validar)?
2. **Papéis**: `admin` e `correspondente` acesso total (default); `gestor` acesso total ao RH; `financeiro` leitura em Prévia/Custos/Holerites. Ninguém mais vê o módulo até você liberar por matriz de permissões em `/admin/pessoas`. Ok?
3. **Integração financeira**: adicionar `rh_origem jsonb` e `rh_funcionario_id uuid` (nullable) em `financial_payables`/`financial_receivables` — sem alterar telas atuais. Ok?
4. **Migrações**: como o módulo cria muitas tabelas, cada fase terá uma migração dedicada (aprovação por fase). Ok?

Assinale “ok, comece Fase 1” (ou aponte ajustes) e eu já executo a migração + as telas da Fase 1.
