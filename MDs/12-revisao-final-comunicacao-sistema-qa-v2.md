# Etapa 12 — Revisão Final 2.0: Comunicação Sistêmica + Segurança + QA

> Executar após Etapas 01–11 concluídas e antes do deploy. Substitui `12-revisao-final...md`.

## 1. Escopo desta revisão

1. **Comunicação entre módulos** — todo objeto criado por uma etapa é efetivamente consumido pelas etapas seguintes.
2. **Sistema como um todo** — build, tipos, RLS, seed, marca branca, ausência de integrações proibidas, políticas de segurança avançadas, performance.
3. **QA automatizado** — execução do roteiro `11-v2` em modo checklist, com evidências.

O agente executa, corrige o que quebrou (sem introduzir features novas), e emite relatório. Bloqueios de produto listados em "Bloqueios".

## 2. Parte A — Comunicação entre módulos

Para cada item, o agente: (i) confirma existência, (ii) roda leitura/escrita real via `supabase--read_query`/`supabase--insert` ou navegação Playwright, (iii) marca ✔/✖.

### A.1 Fundação → todas
- `has_role(uuid, app_role)` `SECURITY DEFINER` presente e usada em toda policy RLS.
- Toda tabela de negócio tem `correspondente_id` + policy restringindo ao ecossistema.
- Trigger `handle_new_user_profile` cria profiles/user_roles e para correspondente-raiz define `correspondente_id = profiles.id`.
- Todo GRANT presente (authenticated, service_role; anon só onde há policy pública).

### A.2 Shell (02) ↔ demais
- Layout `_authenticated` renderiza `<Outlet />`.
- Menu filtrado em tempo real (testar 3 papéis).
- `notificacoes` gravada por 04 (retorno banco), 05 (mudança status), 06 (comissão), 07 (SLA), 09 (mensagem cliente), 10 (auditoria crítica).

### A.3 CRM (03) ↔ Simulações/Propostas/App Cliente
- "Puxar do CRM" existe em Simulação (04) e Proposta (05); importa `cliente_id` + snapshot + docs.
- Simulação `simulada` → botão "Promover a Proposta" chama `criarProposta` (05).
- `contrato_emitido` → CRM cliente → etapa final (verificar `cliente_pipeline`).
- Habilitar Portal do Cliente → login em `/portal` OK; revogar → falha imediata.

### A.4 Simulações (04) ↔ Propostas (05) ↔ Financeiro (06)
- `propostas.simulacao_id` nullable (proposta manual).
- Trigger `on_proposta_contrato_emitido` gera CR + CP + `comissoes_usuario`.
- Cron `/api/public/sync-propostas` atualiza status via polling.
- Seed bancos: Bradesco/Santander/Itaú ativos; Inter/Caixa cadastrados inativos.
- Santander HE usa rota Somahome (`idOperacao=6`).

### A.5 Tarefas/Demandas (07) e Relatórios (08)
- SLA calculado com horas úteis + feriados; escalonamento no 100%.
- Relatórios (`runReport`) respeitam `correspondente_id` — testar cross-tenant.
- Central de Chats agrega clientes + DMs + demandas em `/operacional/chats`.

### A.6 App Cliente (09), RH (11) e Admin (10)
- Login cliente CPF/CNPJ+data com RLS ao próprio cliente_id.
- `/admin/bancos` armazena só nome do secret; testes de conectividade OK antes de ativar.
- Portal do Parceiro unificado: `acesso_tipo='portal_parceiro'` logando em `/parceiro` navega para `/parceiro-inicio` no shell interno; rotas antigas redirecionam.
- RH → CP idempotente por `(funcionario_id, competencia)`.
- Auditoria recebe eventos das etapas 01–11.

### A.7 Comunicação **PROIBIDA** (checar ausência)
- `rg -n "twilio|sendgrid|resend|postmark|nodemailer|whatsapp|zenvia|infobip|web push|firebase" src/` → 0 hits.
- `rg -n "ai.gateway.lovable.dev|@lovable/|lovable-ai-" src/` → 0 hits.
- `rg -i "HomeFin|Lovable|Supabase" src/` filtrado (excluindo `.env`, `integrations/`, comentários, nomes de tabela) → 0 hits em texto renderizado.
- `/api/public/homefin/callback` **não existe** (integração é polling puro).

## 3. Parte B — Sistema

### B.1 Build e tipos
- `bunx tsgo` — 0 erros.
- Build de produção conclui.
- Zero `any` novo em `src/integrations/homefin/` (100% gerado do swagger).

### B.2 Banco e RLS
- `supabase--linter` — sem warning novo.
- Toda tabela pública com RLS.
- Nenhuma tabela sensível concede SELECT a `anon`.
- `banco_credenciais`, `admin_audit_logs`, `financial_*`, `cliente_auditoria` NÃO retornam nada como `authenticated` de outro ecossistema.

### B.3 Segurança avançada (2.0)
- Nenhum secret em código-fonte (`rg -n "sk_|xoxb-|SECRET|PRIVATE_KEY" src/`).
- `supabaseAdmin` só importado dentro de handler (`await import(...)`); nunca em rota/cliente.
- Webhooks `/api/public/*` validam assinatura (o único hoje é `sync-propostas` com `CRON_SECRET`).
- Toda server fn com mutação privilegiada verifica role via `context.supabase.rpc('has_role', ...)`.
- **Reprompt de senha** em ações críticas admin (bancos/credenciais, backup, mudar acesso_tipo).
- Rate-limit em login/OTP/portal/cliente/exports validados.
- Cookie App Cliente HttpOnly + Secure + SameSite=Lax.
- PII masking automático em UI/XLSX/PDF quando sem `pii:view`.
- Rotação de secrets: badge amarelo em `/admin/integracoes` se >90d.
- Auditoria com hash SHA-256 em cada export PDF.
- Detecção de anomalia (login IP novo, N ações admin em 5min, export massivo) → notifica correspondente.

### B.4 Marca branca e design
- Nenhuma logo/ícone gerado por IA. Assets vindos de `Logos e a API/` copiados para `src/assets/brand/`.
- Tokens semânticos em `src/styles.css`; sem `text-white`/`bg-black`/`bg-[#...]` nos componentes.
- Fonte Inter Variable local, sem `<link>` remoto em CSS.
- `<title>`, `og:*`, `twitter:*` reais em cada rota — nunca "Lovable App".

### B.5 Performance mínima
- Toda listagem tem `LIMIT` + paginação.
- Toda subscription realtime dentro de `useEffect` com cleanup `supabase.removeChannel`.
- Painel geral <1s com 10k propostas.
- Bundle inicial <300KB gzip.
- Queries lentas (>500ms) reportadas por `supabase--slow_queries` reduzidas.
- Cache TanStack Query `staleTime` 30s em KPIs, 5min em dados de referência.

## 4. Parte C — QA automatizado

Rodar Playwright contra `http://localhost:8080` reproduzindo `11-v2`. Salvar screenshots em `/tmp/browser/qa/`.

### C.1 Golden Path (cadastro → contrato)
1. `/auth` aba Criar conta → correspondente.
2. `/admin/bancos` → Bradesco ativo.
3. `/admin/pessoas` → convidar 1 gestor + 1 corretor (com toggle Portal do Parceiro).
4. `/crm/clientes/novo` → cliente PF, habilitar portal, anexar doc.
5. `/operacional/simulacoes/completa` → 3 bancos + LGPD/SCR → envio real → comparativo.
6. "Promover a Proposta" → PRO gerada com snapshot.
7. Simular contrato_emitido → CR + CP + `comissoes_usuario`.
8. Login cliente em `/portal` → vê própria proposta na timeline.
9. Login corretor em `/parceiro` → aterrissa em `/parceiro-inicio` e vê só o próprio cliente.

### C.2 Proposta manual sem simulação
- Criar em `/operacional/propostas/nova` modo B → `simulacao_id` NULL, fluxo completo funcional.

### C.3 Isolamento entre correspondentes
- Segundo correspondente-raiz → nenhum dado do primeiro visível em nenhum módulo.

### C.4 Cenários negativos
- `/admin/bancos` autenticado como analista → 403.
- `SELECT * FROM banco_credenciais` como publishable → 0 linhas.
- Corretor tentando ver comissão de outro → 403 + audit log.

### C.5 RH e Financeiro (2.0)
- Cadastrar funcionário → CP gerado no dia 5 (idempotente).
- Holerite calcula INSS/IRRF 2025 corretamente.
- PDF ficha funcionário sai portrait com marca d'água.

### C.6 Chat e notificação (2.0)
- Enviar msg em `/crm/chat` → cliente recebe realtime; badge no sino sobe.
- Chat minimizado pisca ao receber msg em background.
- `{numero_proposta}` substituído em template do operador.

## 5. Relatório final (formato de saída)

```
# Relatório de Revisão Final 2.0

## Parte A — Comunicação entre Módulos
- A.1 Fundação: ✔/✖
- A.2 Shell: ✔/✖
- A.3 CRM: ✔/✖
- A.4 Simulações/Propostas/Financeiro: ✔/✖
- A.5 Tarefas/Demandas/Relatórios: ✔/✖
- A.6 App Cliente/RH/Admin: ✔/✖
- A.7 Comunicação proibida: ✔/✖

## Parte B — Sistema
- Build & tipos: ✔/✖
- Banco & RLS: ✔/✖
- Segurança avançada 2.0: ✔/✖
- Marca branca & design: ✔/✖
- Performance: ✔/✖

## Parte C — QA
- Golden path: PASS/FAIL
- Proposta manual: PASS/FAIL
- Isolamento: PASS/FAIL
- Negativos: PASS/FAIL
- RH + Financeiro: PASS/FAIL
- Chat + Notif: PASS/FAIL

## Correções aplicadas
- (arquivos + motivo)

## Bloqueios (decisão de produto)
- (itens que não pude corrigir sem decisão humana)

## Veredito
[ ] APTO para publicação
[ ] APTO com ressalvas
[ ] NÃO APTO (listar críticos)
```

## 6. Regras de execução

- **Não** adicionar features novas. Ajuste mínimo para desbloquear (policy faltante, botão desconectado, seed).
- **Nunca** ignorar item ✖ silenciosamente.
- Playwright headless, viewport 1280×1800, screenshots por passo.
- Autenticação sandbox via `LOVABLE_BROWSER_SUPABASE_*`; nunca logar tokens.
- Se sandbox bancária cair, marca `PENDENTE — provedor indisponível` e segue.
