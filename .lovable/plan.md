# Auditoria — Etapa 12 (Painel Inicial) e CRM de Clientes

Antes de iniciar, alinhar escopo e ordem de execução. O trabalho será entregue em **2 passes independentes** (Painel primeiro, depois CRM), cada um seguindo o mesmo protocolo obrigatório do prompt.

---

## Escopo mapeado

**Painel Inicial** (Etapa 12) — arquivos identificados:
- `src/routes/_authenticated/dashboard.tsx` — painel principal (Correspondente + Parceiro via matriz de permissões)
- `src/routes/_authenticated/visao-geral.painel.tsx` — visão consolidada
- `src/routes/_authenticated/crm.painel.tsx` · `operacional.painel.tsx` · `financeiro.painel.tsx` — painéis modulares acionados pelos atalhos
- Componentes de KPI/Card/Gráfico em `src/components/dashboard/*` e `src/components/paineis/*`
- Server functions em `src/lib/dashboard/*.functions.ts` / `src/lib/paineis/*`
- Realtime: canais `notificacoes`, `demandas`, `propostas`, `simulacoes`

**CRM de Clientes** — arquivos identificados:
- `crm.clientes.tsx` (lista) · `crm.clientes_.$id.tsx` (ficha) · `crm.clientes_.novo.tsx` (novo)
- `crm.painel.tsx` · `crm.chat.tsx` · `crm.documentos.tsx` · `crm.parceiros.tsx` · `crm.scan-ia.tsx`
- Componentes: `src/components/crm/*` (pipeline, timeline, ficha, documentos, interações, historico)
- Server fns: `src/lib/crm/*.functions.ts` (clientes, pipeline, documentos, interações, historico)
- Tabelas Supabase: `clientes`, `cliente_enderecos`, `cliente_pipeline`, `cliente_pipeline_historico`, `cliente_historico`, `cliente_interacoes`, `cliente_documentos`, `cliente_documento_pastas`, `cliente_imoveis`, `cliente_vendedores`, `cliente_parceiros`, `cliente_portal_acessos`, `pipeline_stages`

---

## Protocolo aplicado em cada pass

Para cada tela do escopo:

1. **Auditoria de código** — leitura completa dos arquivos, server fns e queries.
2. **Bugs & correções** — lista de achados com `problema → arquivo → causa → solução → validação` (formato pedido no item 1 do prompt).
3. **Validação de dados reais** — para cada card/KPI/gráfico/lista: tabela de origem, campos, cálculo, escopo (RLS), filtros, comportamento vazio/erro. Zero mock.
4. **Refatoração dirigida** — extração de componentes reutilizáveis, hooks, services, remoção de duplicações, tipagem, constantes centralizadas. Sem reescrever o que já está bom.
5. **UX/UI/A11y/Responsivo** — refino sem alterar identidade visual (tokens da marca preservados). Estados vazio/loading/erro. Foco de teclado. `aria-*`. Mobile-first (375/768/1280).
6. **Paridade Correspondente ↔ Parceiro** — confirmar que ambos usam a mesma tela, componentes e layout, com diferença apenas em `permissions`/`escopo`. Onde houver duplicata, unificar.
7. **RLS & permissões** — auditoria das policies das tabelas envolvidas com `supabase--read_query`; validar que o filtro no frontend tem contrapartida no banco.
8. **Checklist de QA** — checklist específico da tela (não genérico), no formato do item 6 do prompt, entregue ao final de cada pass.

---

## Ordem de execução proposta

### Pass 1 — Painel Inicial (Etapa 12)

```text
1. Mapear cada elemento visual → fonte de dados real  (matriz origem × cálculo × escopo)
2. Auditar dashboard.tsx + server fns de KPI  (achados + correções)
3. Auditar painéis modulares (crm/operacional/financeiro/visao-geral)  (paridade + reuso)
4. Realtime: verificar canais, cleanup, invalidations sem storm
5. Refino UX: hierarquia de cards, skeletons, empty states, responsivo
6. Paridade Correspondente/Parceiro via matriz de permissões
7. Checklist QA do Painel
```

### Pass 2 — CRM de Clientes

```text
1. Lista (crm.clientes.tsx): busca, filtros (parceiro/responsável/status/pipeline), paginação, ordenação, contadores
2. Novo/Editar (crm.clientes_.novo.tsx + ficha): validação CPF/CNPJ, duplicidade, máscaras, endereço, vínculos
3. Ficha (crm.clientes_.$id.tsx): abas (dados, endereço, imóveis, vendedores, documentos, simulações, propostas, demandas, histórico, portal, LGPD)
4. Pipeline/esteira: transições, histórico, stepper (sem cadeados — já entregue)
5. Documentos do cliente: pastas hierárquicas, upload, permissões do bucket
6. Interações & histórico: registro real, timeline, filtros por tipo
7. Portal do cliente: geração de acesso, reset, status
8. Scan IA (integração): leitura, campos extraídos, auditoria
9. RLS: policies de clientes/pipeline/documentos por escopo (próprios/parceiro/equipe/todos/personalizado)
10. Paridade Correspondente/Parceiro
11. Checklist QA do CRM
```

---

## Entregáveis por pass

- **Relatório de bugs corrigidos** no formato exigido (problema/arquivo/causa/solução/validação/risco).
- **Matriz de dados reais** por tela (elemento → tabela → campos → cálculo → escopo → filtros).
- **Diffs de refatoração** com justificativa curta.
- **Checklist QA** específico da tela com os agrupamentos exigidos (acesso, formulários, listagens, cards, integrações, interface, segurança).
- **Nota de riscos residuais** e follow-ups.

---

## Confirmações antes de começar

1. **Ordem OK?** Painel primeiro, CRM depois — cada pass entregue completo (código + relatório + QA) antes de iniciar o próximo. Ou prefere CRM antes?
2. **Migrações de schema** — se durante a auditoria eu identificar RLS/policy/coluna faltando, posso propor migração via `supabase--migration` (com aprovação por migração)?
3. **Escopo do "Painel Inicial"** — considero `dashboard.tsx` como principal e trato `visao-geral/crm/operacional/financeiro.painel` como painéis modulares dentro do mesmo pass. Confirma?
4. **Refino visual** — mantenho tokens/paleta atuais (Agilliza `#000F9F`, dark+light). Sem redesign completo, só refinamento de hierarquia/spacing/estados. Confirma?

Após seu OK nessas 4 perguntas, inicio o Pass 1 (Painel) imediatamente sem novas confirmações intermediárias.
