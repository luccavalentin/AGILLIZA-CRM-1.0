# Auditoria de uso do `supabaseAdmin` (service_role)

Data: 2026-07-17
Método: revisão manual do bloco em volta de cada `supabaseAdmin.` (108 ocorrências reais em 12 arquivos), classificando por (a) legitimidade do uso, (b) presença de filtro de tenant (`correspondente_id`) ou dono (`userId`), e (c) confirmação prévia da autorização do chamador.

**Sem alterações de código nesta rodada** — só relatório e recomendação.

## 🟢 GRUPO A — LEGÍTIMO, MANTER (sem risco)

Nestes casos o `supabaseAdmin` é usado para operações que exigem privilégio (bypass de RLS, admin auth, geração de artefatos ou processamento de webhook público) **após** validação explícita do escopo do chamador. Filtro por `correspondente_id` está presente onde aplicável.

| Arquivo                                           | Local                                 | Motivo                                                                                                                             |
| ------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `integrations/supabase/client.server.ts`          | definição                             | Constrói o cliente                                                                                                                 |
| `lib/admin/audit.server.ts`                       | todos                                 | Log de auditoria (system-of-record)                                                                                                |
| `lib/simulacao/homefin.server.ts`                 | todos                                 | Chamadas server-to-server à integração bancária                                                                                    |
| `lib/simulacao/simulacoes.functions.ts` L167–193  | `enviarOtpEmail`                      | Rate limit + insert em `homefin_email_otp` (tabela sem tenant)                                                                     |
| `lib/simulacao/simulacoes.functions.ts` L207–236  | `validarOtpEmail`                     | Consumo do OTP                                                                                                                     |
| `lib/simulacao/simulacoes.functions.ts` L276–504  | `criarSimulacao`                      | Insere com `correspondente_id: me.correspondente_id` (derivado do usuário)                                                         |
| `lib/simulacao/simulacoes.functions.ts` L976–1118 | `duplicarSimulacao`                   | Idem — reaproveita `correspondente_id` do registro-fonte já validado                                                               |
| `lib/propostas/propostas.functions.ts` L400–715   | `criarProposta`                       | Insere com `correspondente_id: me.correspondente_id`                                                                               |
| `lib/propostas/propostas.functions.ts` L1590–1660 | `excluirProposta`/`restaurarProposta` | Fallback só executa após comparar `prop.correspondente_id !== correspondente` e filtrar `.eq("correspondente_id", correspondente)` |
| `lib/operacional/tarefas.functions.ts` L215–265   | criar tarefa                          | Insere com `correspondente_id: corr` derivado do usuário                                                                           |
| `lib/operacional/demandas.functions.ts` L380–432  | criar demanda                         | Corr derivado do usuário; RLS reavaliada gera conflito com trigger                                                                 |
| `lib/operacional/demandas.functions.ts` L729      | `excluirDemanda`                      | `papelNaDemanda(...)` valida `souCriador` via `context.supabase` (RLS) antes do delete                                             |
| `lib/crm/clientes.functions.ts` L322–494          | `criarCliente`                        | Todos os inserts/updates filtram por `correspondente_id: me.correspondente_id`                                                     |
| `lib/parceiro/portal.functions.ts` L72–110        | portal parceiro                       | Lê dados do próprio `userId`/`correspondente_id` derivado da sessão                                                                |
| `lib/admin/regras-modulos.functions.ts` L628–842  | admin                                 | Rota admin — checada por role antes; filtra por `correspondente_id` no fork                                                        |
| `lib/admin/pessoas.functions.ts` todos            | admin                                 | `supabaseAdmin.auth.admin.*` é intrinsecamente service_role                                                                        |
| `routes/api/public/sync-propostas.ts`             | webhook público                       | Endpoint sem sessão — precisa de service_role; valida secret HMAC                                                                  |

## 🟡 GRUPO B — FUNCIONA, MAS DEFESA-EM-PROFUNDIDADE FRACA (recomendo reforçar)

Nestes casos o filtro por `correspondente_id` **está ausente no UPDATE/DELETE**, mesmo que a coluna de filtro (`cliente_id`, `id`) já seja escopada por design. Se algum dia um bug fizer o `cliente_id` bater com um cliente de outro tenant (não é o caso hoje), o soft delete cruzaria fronteiras.

| #   | Arquivo                         | Linha     | Função                 | Problema                                                                                                                    | Correção sugerida                                                                                        |
| --- | ------------------------------- | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| B1  | `lib/crm/clientes.functions.ts` | 1480–1495 | `limparVinculoEsteira` | Soft-delete de `propostas`/`simulacoes` por `cliente_id` sem filtrar `correspondente_id`                                    | Adicionar `.eq("correspondente_id", corr)` (corr já disponível via `correspondenteId(supabase, userId)`) |
| B2  | `lib/crm/clientes.functions.ts` | 1600–1614 | `excluirCliente`       | Cascade soft-delete em `propostas/simulacoes/demandas/tasks/clientes` por `cliente_id`/`id` sem filtrar `correspondente_id` | Idem — adicionar filtro por tenant                                                                       |

**Impacto de aplicar a correção:**

- ✅ Zero regressão em produção (as linhas já pertencem ao mesmo `correspondente_id` do usuário, o filtro extra apenas confirma).
- ✅ Bloqueia um vetor futuro caso um bug de código passe um `cliente_id` errado.
- ⏱ ~10 linhas alteradas em 2 funções.

## 🔴 GRUPO C — VULNERÁVEL (nenhum encontrado)

Não foi identificado nenhum uso de `supabaseAdmin` que permita, hoje, um usuário autenticado alterar/ler dados de outro tenant. Todas as operações privilegiadas são:

- precedidas por checagem explícita do escopo (grupos A/B), ou
- restritas a papéis admin/system (auth admin, backup, webhooks assinados).

## Recomendação

1. **Aplicar apenas B1 e B2** — 2 funções, ~10 linhas — como defesa-em-profundidade.
2. Deixar os demais 106 usos intactos: todos são legítimos e já filtram por tenant onde faz sentido.

**Risco de aplicar B1+B2 em produção:** ✅ nenhum — filtros redundantes que só bloqueiam cenários patológicos.

**Risco de NÃO aplicar:** baixíssimo hoje; vira alto se um bug futuro passar `cliente_id` cruzado.
