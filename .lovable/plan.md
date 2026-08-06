# Automação CLT no módulo de RH

Hoje o RH tem campos soltos (status, documentos, férias, folha) sem regras da CLT amarrando tudo. Vou consolidar toda a vida do funcionário dentro da **ficha**, aplicar automações baseadas em datas e integrar com Contas a Pagar.

## 1. Status automático por experiência (CLT art. 445)

- Novo campo `fim_experiencia` continua manual, mas o padrão vira **admissão + 90 dias** (45+45) quando não preenchido.
- Função SQL `rh_atualizar_status_experiencia()` diária:
  - Se `status = 'experiencia'` e `fim_experiencia < hoje` e não há demissão → vira `ativo`.
  - Se `status = 'ativo'` e admissão < 90 dias e sem `fim_experiencia` explícito → vira `experiencia`.
- Chip visual na ficha: "Em experiência até DD/MM (faltam X dias)" com cor de alerta quando faltar ≤ 15 dias.
- Trigger no INSERT: se `fim_experiencia` vazio, calcula automaticamente.

## 2. Documentos CLT dentro da ficha

Sai a rota avulsa `/rh/documentos` do menu (mantém rota só para uso interno) e passa a viver na aba **Documentos** da ficha (já existe). Adiciono um **checklist CLT obrigatório** semeado ao criar o funcionário:

- RG/CNH, CPF, CTPS, PIS/PASEP, Título de eleitor, Comprovante de residência
- Certidão de nascimento/casamento, Certificado de reservista (M), Foto 3x4
- Exame admissional (ASO) — com validade
- Ficha de dependentes (se houver)
- Contrato de trabalho e Termo de experiência
- Vale-transporte / opção de VT

Cada item da ficha tem: obrigatório?, status (`pendente|entregue|vencido`), validade (para ASO/CNH), arquivo. Painel no topo da aba com "X de Y documentos entregues" e alertas de vencimento.

## 3. Férias automáticas (CLT art. 130)

- Cria-se automaticamente o **período aquisitivo** no INSERT do funcionário: 12 meses após admissão.
- Job diário calcula:
  - `dias_direito` = 30 (com faltas ≤ 5), 24 (6-14), 18 (15-23), 12 (24-32), 0 (>32) — puxando de `rh_ocorrencias` tipo falta injustificada.
  - `limite_concessivo` = fim do aquisitivo + 12 meses. Passou → chip "vencidas — dobro".
- Aba **Férias** da ficha mostra períodos, dias disponíveis e programação. Botão "Programar férias" já existe; passo a preencher automaticamente o próximo período.

## 4. Dia de pagamento → Contas a Pagar

Na ficha, novo grupo **Pagamento**:
- `dia_pagamento_salario` (1–31, padrão 5 — limite CLT art. 459)
- `dia_pagamento_adiantamento` (opcional, padrão 20)
- `gerar_contas_pagar_automatico` (bool)

Server fn `gerarContasPagarSalarios(competencia)`:
- Para cada funcionário ativo com `gerar_contas_pagar_automatico=true`, cria em `financial_payables` um lançamento com vencimento no próximo dia útil ≥ dia configurado, valor = salário líquido da prévia (ou bruto se ainda não fechada), categoria "Folha de pagamento", favorecido = funcionário.
- Idempotente por `(funcionario_id, competencia)` via nova coluna `origem_ref`.
- Botão manual na página **Prévia da folha** ("Gerar contas a pagar") + job mensal opcional.

Adiantamentos e descontos que já existem passam a virar linhas separadas em Contas a Pagar quando marcados como "pagar via financeiro".

## 5. Ficha completa em PDF (marca d'água Agilliza)

Novo `src/lib/rh/ficha-funcionario-pdf.ts` (jsPDF, retrato):
- Cabeçalho com logo Agilliza + dados do ecossistema (razão social, CNPJ).
- Foto 3x4 do funcionário + dados pessoais, documentos, endereço, dados bancários.
- Vínculo (cargo, departamento, gestor, admissão, salário atual, tipo de contrato).
- Histórico salarial e de cargos.
- Lista de documentos entregues + validades.
- Férias (períodos aquisitivos e gozados).
- Marca d'água diagonal "AGILLIZA — CONFIDENCIAL" em cinza claro em todas as páginas.
- Rodapé com data de emissão e nome do usuário.

Botão **"Imprimir ficha completa"** no topo da ficha (`rh.funcionarios_.$id.tsx`).

## 6. Armazenamento

Documentos usam o bucket `rh-documentos` já existente (path `funcionario/{id}/…`). Nada muda de storage; só o fluxo de anexar passa a ser feito dentro da aba, sem tela avulsa.

## Detalhes técnicos

**Migração** (uma única):
- `rh_funcionarios`: `dia_pagamento_salario int`, `dia_pagamento_adiantamento int`, `gerar_contas_pagar_automatico bool default false`.
- `rh_documentos_checklist` (id, funcionario_id, tipo, obrigatorio, status, documento_id fk, validade, updated_at) + grants + RLS por correspondente.
- `financial_payables`: `origem_tipo text`, `origem_ref text` (para idempotência da folha).
- Função `public.rh_semear_checklist_clt(func_id uuid)` chamada em trigger AFTER INSERT.
- Função `public.rh_atualizar_status_experiencia()` (agendada por pg_cron diário) + trigger BEFORE INSERT que define `fim_experiencia` padrão.
- Função `public.rh_semear_periodo_aquisitivo(func_id uuid)` em trigger AFTER INSERT.

**Server fns** (`src/lib/rh/`):
- `checklist.functions.ts`: listar/atualizar itens do checklist.
- `ferias-auto.functions.ts`: recalcular dias de direito, listar períodos.
- `folha-contas-pagar.functions.ts`: `gerarContasPagarSalarios`.
- `ficha-pdf.functions.ts`: agrega dados para PDF.

**UI**:
- `ficha-tabs.tsx`: aba Documentos ganha checklist obrigatório no topo; aba Férias mostra períodos aquisitivos; nova aba **Pagamento** com dia + toggle contas a pagar.
- `rh.funcionarios_.$id.tsx`: botão "Imprimir ficha".
- `rh.previa-folha.tsx`: botão "Gerar contas a pagar do mês".
- Menu: `Documentos` e `Férias` avulsos do RH ficam ocultos (redirect para dentro da ficha ou lista simples só de leitura).

Sem mocks, tudo real via Supabase, respeitando RLS por correspondente.
