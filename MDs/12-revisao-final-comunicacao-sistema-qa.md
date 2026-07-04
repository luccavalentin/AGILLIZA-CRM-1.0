# Etapa 12 — Revisão Final: Comunicação entre Módulos, Revisão de Sistema e Testes de QA

> Executar **depois** das Etapas 01–10 e **antes** de encerrar o projeto. Este prompt é um checklist executável para o mesmo agente que construiu o sistema (ou um agente auditor). Ele **não** cria funcionalidade nova — apenas verifica, corrige inconsistências e produz um relatório final. Complementa o `11-qa-homologacao.md` (que é o roteiro de teste funcional ponta a ponta operado por QA humano).

> Cole as **Convenções Globais** (`00-convencoes-globais.md`) e os **Design Tokens** (`00b-tons-cores-design-tokens.md`) antes deste prompt.

## Escopo desta revisão
1. **Revisão de Comunicação** — todo objeto criado por uma etapa está sendo realmente consumido pelas etapas seguintes conforme o bloco `Dependências e Produtos` de cada prompt.
2. **Revisão de Sistema** — build, tipos, RLS, seeds, marca branca, ausência de integrações proibidas, políticas de segurança, performance mínima.
3. **Testes automatizados de QA** — execução do roteiro 11 em modo checklist, com evidências (prints, logs, IDs de registro criados).

O agente deve **executar as verificações**, **corrigir** o que estiver quebrado (sem introduzir novas features), e **emitir um relatório** ao final. Se algo exigir decisão de produto, listar em "Bloqueios" e parar — não inventar.

---

## Parte A — Revisão de Comunicação entre Módulos

Para cada item abaixo, o agente deve: (i) confirmar que existe, (ii) rodar a chamada de leitura/escrita real no banco (via `supabase--read_query` / `supabase--insert`) ou uma navegação Playwright, (iii) marcar ✔ ou ✖ e, se ✖, aplicar o ajuste mínimo.

### A.1 Fundação → todas as etapas
- [ ] `public.has_role(uuid, app_role)` existe, é `SECURITY DEFINER` e é usada em **todas** as policies RLS de tabelas de negócio (`clientes`, `simulacoes`, `propostas`, `contas_*`, `comissoes`, `tarefas`, `demandas`, `banco_credenciais`, `auditoria`, `parceiros`). Rodar: `select tablename, policyname, qual from pg_policies where schemaname='public';` e conferir presença de `has_role(` ou `auth.uid()` em cada policy.
- [ ] Toda tabela de negócio tem coluna `correspondente_id` (ecossistema) e policy que restringe leitura/escrita ao ecossistema do usuário.
- [ ] Trigger `handle_new_user_profile` cria `profiles`, `user_roles` e — para novo correspondente-raiz — define `correspondente_id = profiles.id`. Testar criando conta nova em `/auth`.
- [ ] Todo `GRANT` de tabela pública está presente (`authenticated`, `service_role`, e `anon` só onde há policy pública).

### A.2 Shell (02) ↔ demais etapas
- [ ] O layout `_authenticated` renderiza `<Outlet />`; nenhuma tela interna cria sidebar/topbar próprios.
- [ ] O menu está sendo filtrado por `has_role` em tempo real (esconder item indevido) — testar com 3 papéis diferentes.
- [ ] `notificacoes` é gravada pelos módulos 04 (retorno banco), 05 (mudança status), 06 (comissão criada), 07 (SLA), 10 (auditoria crítica) — validar com `select origem, count(*) from notificacoes group by 1`.

### A.3 CRM (03) ↔ Simulações/Propostas/App Cliente
- [ ] Ação **"Puxar do CRM"** existe em `04` (nova simulação) e `05` (nova proposta e upload de documentos), e importa `cliente_id`, snapshot e documentos do bucket `documentos-cliente`.
- [ ] Ao mover `simulacao.status='simulada'` → botão "Promover a Proposta" cria linha em `propostas` via `criarProposta({simulacao_id, banco_id})` (definida em 05, **não** duplicada em 04).
- [ ] Ao `proposta.status='contrato_emitido'`, o card do cliente é movido na esteira para a etapa final (verificar em `cliente_pipeline`).

### A.4 Simulações (04) ↔ Propostas (05) ↔ Financeiro (06)
- [ ] `propostas.simulacao_id` é opcional (permite proposta manual sem simulação prévia).
- [ ] Trigger `on_proposta_contrato_emitido` gera `comissoes` a receber e a pagar (usar regras da parceria em `parceiros`).
- [ ] `logs_integracao` tem entradas para todo POST/GET ao provedor bancário, com `request_id`, `status_http`, `duracao_ms`.
- [ ] Bancos com `ativo=true` no seed: **Bradesco, Santander, Itaú**. Inter e Caixa presentes com `ativo=false`.

### A.5 Tarefas/Demandas (07) e Relatórios (08)
- [ ] SLA está sendo calculado (`sla_regras` semeado); demandas em atraso escalam para o gestor.
- [ ] Painéis de `/relatorios/*` respeitam `correspondente_id` — testar com dois correspondentes e conferir que os números não se cruzam.

### A.6 App Cliente (09) e Admin/Parceiro (10)
- [ ] Login do cliente por CPF/CNPJ + data funciona e restringe RLS a `cliente.user_id = auth.uid()`.
- [ ] `/admin/bancos` grava `banco_credenciais` que **sobrepõe** `.env` em runtime — testar mudando o ambiente para `homologacao` e conferindo no `logs_integracao` que o host mudou.
- [ ] Portal do Parceiro `/parceiro/*` reutiliza componentes de 08 e aplica filtro adicional `parceiro_id = current_parceiro()`.
- [ ] `auditoria` recebe eventos das Etapas 01–09 (login, criação/edição de proposta, mudança de status, exportação de relatório, alteração de credencial).

### A.7 Comunicação **PROIBIDA** (checar ausência)
- [ ] Nenhum código referencia Twilio, SendGrid, Resend, Postmark, Nodemailer, provedores de WhatsApp Business API, SMS. Rodar `rg -n "twilio|sendgrid|resend|postmark|nodemailer|whatsapp|zenvia|infobip" src/`.
- [ ] Nenhum texto visível ao usuário contém `HomeFin`, `Lovable`, `Supabase`, nome de provedor de infra. Rodar `rg -n "HomeFin|Lovable|Supabase" src/ | rg -v "\\.env|integrations/|comment|// "`.

---

## Parte B — Revisão de Sistema

Executar **na ordem** e só passar para o próximo quando o anterior estiver limpo.

### B.1 Build e tipos
- [ ] `bunx tsgo` — 0 erros de tipo.
- [ ] Build de produção conclui.
- [ ] Nenhum `any` novo introduzido em `src/integrations/homefin/` (deve ser 100% gerado do swagger).

### B.2 Banco e RLS
- [ ] Rodar `supabase--linter` — sem `warning` de policy faltante ou `SECURITY DEFINER` sem `search_path`.
- [ ] Toda tabela pública tem `ROW LEVEL SECURITY` habilitada.
- [ ] Nenhuma tabela de dados sensíveis (`clientes`, `propostas`, `comissoes`, `banco_credenciais`, `auditoria`) concede `SELECT` a `anon`.
- [ ] `banco_credenciais` armazena somente o que é necessário e nunca é retornada para o cliente por policy (testar `select * from banco_credenciais` autenticado como papel `atendente` deve retornar 0 linhas).

### B.3 Segurança
- [ ] Nenhum secret em código-fonte (`rg -n "sk_|xoxb-|SECRET|PRIVATE_KEY" src/`).
- [ ] `supabaseAdmin` é importado apenas dentro de `.handler()` de server functions e nunca em código de rota/cliente.
- [ ] Webhooks em `/api/public/*` validam assinatura HMAC antes de processar payload.
- [ ] Roles verificadas via `has_role` em toda server fn com `requireSupabaseAuth` que faz mutação privilegiada.

### B.4 Marca branca e design
- [ ] Nenhuma logo/ícone gerado por IA. Todos vindos de `Logos e a API/Logo PNG/` ou `Logo Vetor/`.
- [ ] Tokens de cor semânticos em `src/styles.css`; nenhum `text-white`, `bg-black`, `bg-[#...]` em componentes.
- [ ] Fontes carregadas via `<link>` em `__root.tsx` — sem `@import` remoto em CSS.
- [ ] `<title>`, `og:*`, `twitter:*` reais em cada rota (nunca "Lovable App").

### B.5 Performance mínima
- [ ] Nenhuma query sem `LIMIT` em telas de lista.
- [ ] Toda `subscribe()` de Realtime está dentro de `useEffect` com cleanup `supabase.removeChannel`.

---

## Parte C — Testes de QA (execução automatizada)

O agente deve rodar Playwright contra `http://localhost:8080` reproduzindo o roteiro do `11-qa-homologacao.md`. Para cada bloco, salvar screenshots em `/tmp/browser/qa/` e anotar no relatório.

### C.1 Cenário "Golden Path" (do cadastro ao contrato)
1. Criar conta de correspondente em `/auth` (aba **Criar conta**) → confirmar redirecionamento autenticado.
2. Ativar Bradesco em `/admin/bancos` → conferir status = ativo.
3. Convidar 1 gestor e 1 parceiro em `/admin/pessoas` → conferir que cada um recebe permissões distintas.
4. Cadastrar 1 cliente PF em `/crm/clientes/novo` → anexar 1 documento.
5. Criar simulação em `/simulacoes/nova` **Puxar do CRM** → enviar ao Bradesco → aguardar retorno mockado/homolog. → conferir `simulacao_bancos` populado.
6. Promover a Proposta → validar `propostas` criada com `simulacao_id` e `homefin_id_oportunidade` preenchidos.
7. Marcar `proposta.status = 'contrato_emitido'` → conferir `comissoes` criada e card do cliente na etapa final.
8. Login como cliente (CPF+data) no App Cliente → conferir que só enxerga a própria proposta.
9. Login como parceiro no Portal → conferir que só enxerga propostas onde é `parceiro_id`.

### C.2 Cenário "Proposta manual sem simulação"
- Criar proposta diretamente em `/propostas/nova` (modo manual) → validar que `simulacao_id` fica nulo e todo o resto do fluxo permanece funcional.

### C.3 Cenário "Isolamento entre correspondentes"
- Criar segundo correspondente-raiz em `/auth` → autenticar e conferir que **nenhum** dado do primeiro aparece em `/crm`, `/simulacoes`, `/propostas`, `/relatorios`.

### C.4 Cenário negativo
- Tentar acessar `/admin/bancos` autenticado como `atendente` → deve receber 403 / redirect.
- Tentar `select * from banco_credenciais` via cliente Supabase publishable → deve retornar 0 linhas.

---

## Relatório final (formato de saída)

Ao terminar, o agente responde com **exatamente** este bloco preenchido:

```
# Relatório de Revisão Final

## Parte A — Comunicação entre Módulos
- A.1 Fundação: ✔/✖ (detalhes)
- A.2 Shell: ✔/✖
- A.3 CRM: ✔/✖
- A.4 Simulações/Propostas/Financeiro: ✔/✖
- A.5 Tarefas/Relatórios: ✔/✖
- A.6 App Cliente/Admin/Parceiro: ✔/✖
- A.7 Comunicação proibida: ✔/✖

## Parte B — Sistema
- Build & tipos: ✔/✖
- Banco & RLS: ✔/✖
- Segurança: ✔/✖
- Marca branca & design: ✔/✖
- Performance: ✔/✖

## Parte C — QA automatizado
- Golden path: PASS/FAIL (IDs criados: cliente=…, simulacao=…, proposta=…, comissao=…)
- Proposta manual: PASS/FAIL
- Isolamento: PASS/FAIL
- Cenários negativos: PASS/FAIL

## Correções aplicadas nesta revisão
- (lista de arquivos alterados e o porquê)

## Bloqueios (decisão do produto necessária)
- (itens que não pude corrigir sem decisão humana)

## Veredito
[ ] APTO para publicação
[ ] APTO com ressalvas (listar)
[ ] NÃO APTO (listar bloqueios críticos)
```

## Regras de execução
- **Não** adicionar features novas. Se um item da Parte A revelar dependência inexistente, aplicar o ajuste mínimo (criar policy faltante, ligar botão desconectado, corrigir seed) — nunca redesenhar módulo.
- **Não** ignorar item marcado ✖ silenciosamente. Ou corrige, ou entra em "Bloqueios".
- Rodar Playwright em `headless=True`, `viewport 1280x1800`, screenshots por passo em `/tmp/browser/qa/<cenario>/`.
- Autenticação via `LOVABLE_BROWSER_SUPABASE_*` conforme instruções do sandbox; nunca logar tokens.
- Nada de mock que mascare falha real: se o provedor bancário estiver fora, marcar o item da Parte C como "PENDENTE — provedor indisponível" e seguir.
