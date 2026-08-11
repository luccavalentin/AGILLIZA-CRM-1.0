# Revisão Geral do Código — Julho/2026

> Revisão consolidada de **Segurança**, **Performance** e **Qualidade** solicitada pelo correspondente. Escopo: toda a base `src/` + migrations + integrações Supabase. **Nenhuma alteração de código foi aplicada** — este documento é o mapa priorizado de intervenção.
>
> Priorização: **P0** = corrigir imediatamente (risco de vazamento/impacto financeiro), **P1** = próximo sprint, **P2** = melhoria contínua.

---

## 0. Resumo executivo

| Dimensão                           | Nota     | Observação                                                                                                                                                                                                    |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança de dados (RLS/policies)  | 🟢 Alto  | RLS habilitado em todas as tabelas de negócio, `has_role`/`usuario_escopo_dados` bem modelados, sem tokens em tabela.                                                                                         |
| Segurança de execução (server fns) | 🟡 Médio | 100% dos `.functions.ts` usam `requireSupabaseAuth`, mas `supabaseAdmin` está em uso extenso (98 ocorrências) e várias funções `SECURITY DEFINER` estão executáveis por `anon/authenticated`.                 |
| Segurança de autenticação          | 🟡 Médio | Leaked password protection **desabilitada** no Supabase.                                                                                                                                                      |
| Performance de queries             | 🟡 Médio | Nenhuma slow-query alarmante estruturalmente, mas há N+1 latente em relatórios e ausência de índices em colunas chave de escopo (`responsavel_id`, `criador_id`, `cliente_id`, `correspondente_id + status`). |
| Performance de front               | 🟡 Médio | Nenhum `console.log` residual, 332 `useEffect` (elevado — muitos podem virar `useQuery`), poucos memos, arquivos gigantes (>2k linhas) prejudicam split.                                                      |
| Qualidade / lint                   | 🔴 Baixo | **8 591 erros de ESLint** (7 329 auto-corrigíveis por `--fix`) — quase todos de formatação (`prettier/prettier`) + **143 usos de `any`**. Zero erros de typecheck (`tsgo` limpo).                             |
| Bundle                             | 🟢 OK    | 60 dependências, sem duplicatas óbvias, sem lockfile inchado.                                                                                                                                                 |

---

## 1. Segurança — Achados

### 1.1 P0 — Funções `SECURITY DEFINER` executáveis publicamente

- **Onde:** 120 funções sinalizadas pelo linter Supabase (`0028_anon_security_definer_function_executable` e `0029_authenticated_security_definer_function_executable`). Exemplos: `portal_cliente_login`, `portal_baixar_dados`, `portal_marcar_lida`, `portal_registrar_documento`, `portal_solicitar_lgpd`, `cliente_pipeline_avancar_para`, `demanda_escalar_vencidas`, `calcular_comissao_proposta`, `handle_new_user_profile`.
- **Risco:** funções `SECURITY DEFINER` rodam com privilégios do dono (bypassa RLS). Se `anon` ou `authenticated` puder invocá-las via PostgREST/RPC e a função não fizer autorização interna, um atacante contorna toda a RLS.
- **Diagnóstico neste projeto:** o portal do cliente **não usa Supabase Auth** (sessão selada em cookie HttpOnly), então essas funções estão sendo chamadas por um cliente publicável do servidor — mas seguem callables via anon key vazada.
- **Ação:** para cada função,
  1. `REVOKE EXECUTE ON FUNCTION public.<nome>(...) FROM anon, authenticated, public;`
  2. `GRANT EXECUTE ... TO service_role;` (elas rodam a partir das server fns com admin client)
  3. Se a função é realmente pública (ex.: `portal_cliente_login`), manter `EXECUTE TO anon` **mas adicionar** verificação de rate-limit + validação de entrada (já existe em `portal_cliente_login`, ok).
- **Migration recomendada:** `revoke_public_execute_secdef.sql` cobrindo o inventário.

### 1.2 P0 — Uso de `supabaseAdmin` como cliente de leitura padrão

- **Onde:** 98 ocorrências em `propostas/`, `crm/`, `simulacao/`, `operacional/`, `parceiro/`, `admin/`.
- **Risco:** `supabaseAdmin` **bypassa RLS**. Se a autorização não estiver 100% amarrada no início do handler, um usuário com role `analista` pode enxergar dados de outro correspondente. Você pagou o custo de escrever RLS + `usuario_tem_acesso_*` — usar admin como default derruba essa defesa em profundidade.
- **Ação:** substituir por `context.supabase` (do `requireSupabaseAuth`) em toda leitura de dados escopados; reservar `supabaseAdmin` para:
  - operações de auditoria (`registrar_auditoria` já ok);
  - webhooks/rotas em `/api/public/*`;
  - promoção de papel/edição administrativa após checagem explícita.
- **Padrão a adotar:** no início de cada handler privilegiado, `RPC has_role(context.userId, 'admin'|'gestor')` **usando `context.supabase`** e só então importar dinamicamente `supabaseAdmin`. Vários arquivos já seguem o padrão — replicar nos demais.

### 1.3 P1 — Rota pública sem verificação de assinatura

- **Arquivo:** `src/routes/api/public/sync-propostas.ts`.
- **Risco:** rota pública que dispara `sincronizarProposta` (chama `supabaseAdmin`). Se não valida um segredo/HMAC, qualquer chamador remoto força sincronização em massa (custo + amplificação de erros HomeFin).
- **Ação:** exigir header `X-Sync-Secret` (env `SYNC_PROPOSTAS_SECRET` via `generate_secret` — não é chave compartilhada externa; é interna). Retornar 401 se ausente/inválido. Registrar log em `admin_audit_logs`.

### 1.4 P1 — Leaked password protection desativada

- **Achado:** linter WARN 124.
- **Ação:** ativar em Supabase → Auth → Providers → Email → "Prevent use of leaked passwords" (HaveIBeenPwned). Zero código.

### 1.5 P1 — Extensão instalada em `public`

- Linter WARN 5. Baixo risco em multi-tenant mas boa prática migrar `pg_trgm`/`unaccent` para schema `extensions`. Não bloqueante.

### 1.6 P1 — 4 tabelas com RLS habilitado sem policies

- Linter INFO 1–4. Sem policies + RLS ligado = ninguém acessa. Se são internas (`homefin_auth_cache`, `homefin_email_otp`, `cliente_app_acessos`, `cliente_app_notificacoes` — acessadas só por `service_role`), **explicitar** com uma policy `TO service_role USING (true)` para deixar a intenção documentada; senão, adicionar policy para o público correto.

### 1.7 P2 — LGPD: retenção pós-contrato

- Já existe `purgar_conversas_pos_contrato` (2 meses). Confirmar se está agendada em `pg_cron` — não vi trigger de agendamento no schema. Sem agendamento, a função nunca roda.
- **Ação:** agendar via `pg_cron` diária.

### 1.8 P2 — PII em logs / mascaramento

- `mask_pii_jsonb` existe mas é `IMMUTABLE` e só cobre chaves no primeiro nível do JSON. `payload_anterior`/`payload_novo` em `admin_audit_logs` podem conter CPF em subobjetos (`cliente.documento`). Recursivar a máscara.

### 1.9 P2 — Sessão do portal do cliente

- Cookie selado em `CLIENTE_APP_SESSION_SECRET` (bom). Verificar:
  - `HttpOnly=true`, `Secure=true`, `SameSite=Lax`;
  - TTL curto (idealmente ≤ 12h) + refresh silencioso;
  - Invalidação server-side ao mudar `portal_acesso_ativo`.

---

## 2. Performance — Achados

### 2.1 P1 — Índices ausentes em colunas de escopo

Todas as funções `usuario_tem_acesso_*` filtram por `correspondente_id` + `responsavel_id/criador_id/cliente_id`. Verifique/adicione (script para conferir com `\di+`):

- `propostas (correspondente_id, status)`, `propostas (usuario_responsavel_id)`, `propostas (cliente_id)`;
- `simulacoes (correspondente_id, status)`, `simulacoes (cliente_id)`, `simulacoes (agrupador_id)`;
- `clientes (correspondente_id, ativo)`, `clientes (documento)` UNIQUE parcial;
- `demandas (correspondente_id, status, prazo_sla)` para a query de escalonamento;
- `tasks (correspondente_id, status, vencimento)`;
- `cliente_app_mensagens (cliente_id, criada_em DESC)`;
- `notificacoes (user_id, lida, created_at DESC)`.
  > Executar `supabase--slow_queries` após uma semana em produção para priorizar.

### 2.2 P1 — Query builder com `select` gigante

`reports.functions.ts` (2 583 linhas) e `paineis.functions.ts` (1 665 linhas) montam builders com múltiplos `.select("id, banco, ...")` — cada string literal é parseada no nível de tipos pelo supabase-js. Isso lentifica o typecheck e amarra tipagens.

- **Ação:** aplicar o padrão do knowledge `query-builder-type-performance` (function `sel(s: string): string` + `.returns<T>()`).

### 2.3 P1 — N+1 latente em relatórios

Vários painéis fazem loops "para cada proposta → busca cliente/banco/parceiro" em JS quando poderia ser um único `select ..., cliente:clientes(nome), banco:proposta_bancos(...)`. Auditar arquivos > 1k linhas em `relatorios/`.

### 2.4 P2 — 332 `useEffect` em `src/`

Sinaliza que dados assíncronos ainda são carregados por `useEffect + setState` em vários pontos. Migrar para `useQuery`/`useSuspenseQuery` reduz re-renders, remove flickers e permite invalidação.

- **Auditoria sugerida:** listar arquivos com >3 `useEffect` (heurística) e migrar em ondas.

### 2.5 P2 — Arquivos gigantes prejudicam code-split

- `reports.functions.ts` (2583), `propostas.functions.ts` (2062), `clientes.functions.ts` (2055), `enviar.server.ts` (1783), `paineis.functions.ts` (1665), `financeiro.functions.ts` (1373), `simulacoes.functions.ts` (1135), `simulacao-pdf.ts` (1072).
- **Ação:** quebrar por domínio funcional (ex.: `propostas/list.functions.ts`, `propostas/mutations.functions.ts`, `propostas/anexos.functions.ts`). Além de reduzir bundle, isola risco.
- **Cuidado:** manter regra de "server fns em `.functions.ts` client-safe path" (ver `tanstack-supabase-import-graph`).

### 2.6 P2 — Realtime / polling

Confirmar que **todos** os canais Supabase Realtime têm cleanup em `useEffect` (regra do knowledge). Já orientado no memory, mas fazer varredura semestral (`rg -n "supabase.channel" src`).

### 2.7 P2 — `simulacao-pdf.ts` — geração síncrona no cliente

1072 linhas usando `pdf-lib`/`jspdf` no thread principal. Em Chrome mobile trava a UI. Considerar Web Worker (`comlink`) ou gerar server-side.

---

## 3. Qualidade — Achados

### 3.1 P0 — 8 591 erros de ESLint

- **7 329 auto-corrigíveis** (`prettier/prettier`: quebras de linha, `Delete ⏎`, `Replace ...`).
- **Ação imediata:** `bunx eslint src --fix` reduz ~85% dos erros sem risco. Rodar num commit isolado, revisar diff, aplicar.
- Restante (~1 260) são `@typescript-eslint/no-explicit-any` e outros: exige refactor manual.

### 3.2 P1 — 143 usos de `any`/`as any`/`@ts-ignore`

- Concentração em rotas do portal do cliente (`cliente.perfil.tsx`, `cliente.visao-geral.tsx`) e alguns wrappers.
- **Ação:** substituir por tipos derivados de `Database["public"]["Tables"]["..."]["Row"]` ou tipos explícitos das server fns. Priorizar arquivos > 5 ocorrências.

### 3.3 P1 — Typecheck limpo mas TanStack usa `inputValidator` (deprecated)

Aviso reportado em turnos anteriores. Migrar para `.validator(z.object(...))` no fim das próximas etapas para evitar quebra em upgrade da lib.

### 3.4 P2 — Duplicações potenciais no chat

Auditorias 21/22 já mapearam. Ainda existem `chat-cliente.tsx`, `chat-cliente-instagram.tsx`, `demanda-chat.tsx` e `floating-chat-host.tsx`. Unificar em `<ChatCore/>` com variantes por prop reduz manutenção e evita divergência de features (som, blink, upload).

### 3.5 P2 — `municipios-br.ts` — 5 575 linhas no bundle do cliente

Todo cliente CRM baixa a lista inteira do IBGE. Alternativas:

- Carregar via `React.lazy` só quando o combobox abre;
- Servir via server fn com autocomplete (query `ilike` no banco).

### 3.6 P2 — Console

Só **1 arquivo** com `console.log`/`debug` — excelente higiene. Manter regra de lint `no-console` (warn) em CI.

### 3.7 P2 — Cobertura de testes

Não há testes automatizados no repositório. Recomendação mínima:

- Testes de contrato para `has_role`, `usuario_tem_acesso_*`, `calcular_comissao_proposta` (SQL/pgTAP);
- Testes de unidade para `simulacao/renda.ts`, `state-machine.ts`, `add_horas_uteis`;
- Smoke Playwright para 5 fluxos críticos (login, criar cliente, criar simulação, enviar proposta, portal do cliente).

### 3.8 P2 — Arquivos de teste esquecidos

- `test.pdf` na raiz do projeto — mover para `/tmp/` ou remover.

---

## 4. Plano de ação recomendado (ordem)

1. **Hoje (P0):**
   - `bunx eslint src --fix` → commit "chore: eslint auto-fix";
   - Migration `revoke_public_execute_secdef.sql` fechando SECDEF (item 1.1);
   - Auditoria de `supabaseAdmin` — substituir por `context.supabase` onde possível (item 1.2);
   - Adicionar secret + verificação em `api/public/sync-propostas.ts`;
   - Ativar Leaked Password Protection no dashboard.
2. **Semana 1 (P1):**
   - Índices Postgres (item 2.1);
   - Substituir `select` gigantes por `sel()` + `.returns<T>()` em `reports/`;
   - Zerar `any`;
   - Explicitar policies faltantes (item 1.6).
3. **Semanas seguintes (P2):**
   - Quebrar arquivos > 1k linhas;
   - Migrar `useEffect` de fetch para `useQuery`;
   - Web Worker para PDF;
   - Testes mínimos (SQL + Playwright);
   - Agendar `purgar_conversas_pos_contrato` em `pg_cron`.

---

## 5. O que **não** virou alerta

- Segredos: nenhum hardcoded em `src/`. Uso de `import.meta.env.VITE_*` e `process.env.*` no lado correto ✔.
- Import guards: apenas `homefin.server.ts` importa `supabaseAdmin` no topo (arquivo `.server.ts`, permitido). Todos os `.functions.ts` usam `await import(...)` dinâmico ✔.
- RLS: todas as tabelas de negócio têm policies. Papéis em `user_roles` separado ✔.
- Zero `console.log` residual ✔.
- Typecheck (`tsgo`): sem erros ✔.

---

_Última atualização: 17/07/2026._
