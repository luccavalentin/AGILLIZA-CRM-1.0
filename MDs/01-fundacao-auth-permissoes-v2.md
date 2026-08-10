# Etapa 01 — Fundação 2.0: Acessos, Papéis, Permissões e Auditoria

> Cole `00-convencoes-globais-v2.md` + `00b-tons-cores-design-tokens-v2.md` antes deste. Esta é a base — todos os módulos subsequentes dependem dela.

## 1. O que este módulo produz

**Tabelas** (todas com RLS obrigatória):

- `profiles(id, correspondente_id, nome, email, telefone, foto_url, ativo, acesso_tipo enum('sistema'|'portal_parceiro'), nivel_acesso_id, tipo_pessoa, tema_preferido, ...)`.
- `user_roles(user_id, role app_role, created_at)` — separada de profiles (evita privilege escalation).
- `access_levels(id, correspondente_id, nome, descricao, ativo)` — níveis customizáveis pelo correspondente.
- `permissions(id, nivel_acesso_id, modulo, acao, permitido, escopo enum('todos'|'equipe'|'proprios'|'personalizado'))`.
- `permission_escopo_alvos(permission_id, user_alvo_id)` — para escopo personalizado.
- `tipos_pessoa(slug, nome, descricao, ativo, correspondente_id)` — tipos editáveis pelo correspondente.
- `admin_audit_logs(id, actor_id, acao, entidade, entidade_id, payload_anterior, payload_novo, ip, user_agent, created_at)`.

**Funções SQL SECURITY DEFINER**:

- `has_role(uid uuid, r app_role) → bool` — usada em TODAS as policies de negócio.
- `usuario_tem_permissao(uid, modulo, acao) → bool` — leitura da matriz.
- `usuario_escopo_dados(uid, modulo) → text` — retorna `todos|equipe|proprios|personalizado`.
- `usuario_escopo_inclui_dono(uid, modulo, dono_id) → bool` — para escopo personalizado.
- `handle_new_user_profile()` — trigger AFTER INSERT em `auth.users`, cria `profiles` + `user_roles`, define `correspondente_id = NEW.id` para correspondente-raiz.

**Rotas públicas obrigatórias**:

- `/` — landing com 3 cards (Correspondente, Cliente, Parceiro).
- `/auth` — abas **Entrar** (todos) e **Criar conta** (só correspondente-raiz).
- `/portal` — login do cliente (CPF/CNPJ + data).
- `/parceiro` — login do parceiro.
- `/politica-de-privacidade`, `/cliente-consentimento` — LGPD.

**Rotas autenticadas administrativas** (nesta etapa: esqueleto; Etapa 10 estende):

- `/admin/pessoas` — CRUD unificado de pessoas do ecossistema (equipe interna + parceiros na mesma lista, com 3 abas: **Pessoas**, **Tipos de Pessoa**, **Regras & Permissões**).

## 2. Papéis (fixos)

| `app_role`       | Quem é                          | Escopo padrão              | Cria usuários?                    |
| ---------------- | ------------------------------- | -------------------------- | --------------------------------- |
| `admin`          | Suporte técnico da plataforma   | Global (manutenção)        | Só correspondente-raiz            |
| `correspondente` | Dono do ecossistema             | Todo o ecossistema         | **SIM** — todos os demais         |
| `gestor`         | Braço direito do correspondente | Todo, limitado pela matriz | Sim, quando autorizado            |
| `comercial`      | Vendedor                        | Próprios + equipe          | Não                               |
| `analista`       | Analista de crédito             | Propostas atribuídas       | Não                               |
| `financeiro`     | Financeiro                      | Módulo financeiro completo | Não                               |
| `imobiliaria`    | Imobiliária parceira (PJ)       | Só clientes indicados      | Corretores da própria imobiliária |
| `corretor`       | Corretor autônomo/vinculado     | Só clientes indicados      | Não                               |
| `cliente`        | Cliente final                   | Só o próprio processo      | Não                               |

## 3. Regra de origem de conta (única fonte da verdade)

| Tipo de acesso                                                             | Onde loga                              | Como nasce                                                                      | Quem cria                        |
| -------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| Correspondente                                                             | `/auth` (aba **Criar conta**)          | Auto-cadastro público (nome+email+telefone+senha) + confirmação nativa Supabase | Ele mesmo                        |
| Cliente final                                                              | `/portal` (CPF/CNPJ + data)            | Cadastrado no CRM + toggle "Habilitar acesso ao Portal do Cliente" ligado       | Correspondente/gestor autorizado |
| Qualquer outro (gestor/comercial/analista/financeiro/imobiliária/corretor) | `/auth` OU `/parceiro` conforme toggle | Cadastro em `/admin/pessoas` com senha temporária exibida uma vez               | Correspondente/gestor autorizado |

**Roteamento pós-login** é decidido pelo toggle **"Acesso ao Portal do Parceiro"** em `/admin/pessoas` → grava `profiles.acesso_tipo`:

- `sistema` → login em `/auth`, shell interno completo filtrado pelo nível.
- `portal_parceiro` → login em `/parceiro`, mesmo shell interno mas com nav e escopo restritos.
- `cliente` → só `/portal`.

Não é o papel que decide — é o toggle. Trocar o toggle depois revoga sessões ativas e loga em `admin_audit_logs`.

## 4. Fluxo de auto-cadastro do correspondente

1. Usuário em `/auth` aba **Criar conta** preenche nome, e-mail, telefone, senha + confirma, aceita termos LGPD.
2. `supabase.auth.signUp({ options: { data: { full_name, telefone, papel_inicial: 'correspondente' } } })`.
3. Supabase envia e-mail de confirmação nativo.
4. No primeiro login, trigger `handle_new_user_profile()`:
   - Cria `profiles` com `correspondente_id = NEW.id` (aponta para si mesmo), `acesso_tipo='sistema'`, `tipo_pessoa='correspondente'`.
   - Insere `user_roles(user_id, role='correspondente')`.
   - Semeia `access_levels` padrão do ecossistema (Gestor, Comercial, Analista, Financeiro).
   - Semeia `tipos_pessoa` padrão (Correspondente, Gestor, Comercial, Analista, Financeiro, Imobiliária, Corretor, Cliente).
5. Redireciona para `/dashboard`.

## 5. Fluxo de convite (equipe interna e parceiros — lista única)

Formulário `/admin/pessoas` → **Nova pessoa** (também em edição):

1. **Dados básicos**: nome, e-mail, telefone, CPF/CNPJ.
2. **Card "Acesso"**:
   - Toggle **"Habilitar login"** (default false).
   - Toggle **"Acesso ao Portal do Parceiro"** (aparece só se login habilitado).
   - Se **LIGADO** → campos exclusivos de parceiro (CRECI, razão social, logo upload, % comissão, imobiliária vinculada). `user_roles` recebe `corretor` (default) ou `imobiliaria` (PJ).
   - Se **DESLIGADO** → dropdown **"Nível de acesso interno"** obrigatório (Gestor/Comercial/Analista/Financeiro/customizado). `user_roles` derivado do nível.
   - Campo **"Senha temporária"** (mín 8 chars, gerador automático).
3. Salvamento chama server fn `criarPessoaComAcesso` que via `supabaseAdmin`:
   - Cria `auth.users` com `email_confirm=true` (sem envio de e-mail — sistema não integra provedor).
   - Cria `profiles` com `correspondente_id = correspondente_id do criador`, `acesso_tipo`, `nivel_acesso_id`.
   - Insere `user_roles`.
   - Registra em `admin_audit_logs` (`acao='pessoa.criar'`).
4. Modal **"Copiar senha temporária"** exibe e-mail + senha em campo monoespaçado, botão "Copiar" e aviso "Esta senha não será exibida novamente. Repasse pelo canal seguro fora do sistema."
5. Ações por linha: editar, ativar/desativar login (revoga sessão), resetar senha (nova temporária), transferir carteira (parceiro), excluir (soft delete).

## 6. Matriz de permissões

**Módulos** (chave `modulo:acao`):

- `crm.clientes:view/create/edit/delete/export/pii:view/portal:manage`
- `crm.chat:view/enviar/gerenciar_etiquetas`
- `crm.parceiros:view/create/edit`
- `crm.scan_ia:view/create`
- `operacional.simulacoes:view/create/edit/delete/enviar_banco/reenviar`
- `operacional.propostas:view/create/edit/enviar_banco/cancelar/promover`
- `operacional.tarefas:view/create/edit/atribuir`
- `operacional.demandas:view/create/transferir/encerrar`
- `financeiro.contas_pagar:view/create/edit/baixar/estornar`
- `financeiro.contas_receber:view/create/edit/baixar/estornar`
- `financeiro.comissoes:view/edit/recalcular`
- `financeiro.fluxo_caixa:view/export`
- `rh.funcionarios:view/create/edit/delete/imprimir_ficha`
- `rh.folha:view/gerar/aprovar`
- `rh.holerites:view/emitir`
- `relatorios.<recorte>:view/export`
- `admin.<submodulo>:view/edit`
- `shell.notificacoes:view`, `conta.perfil:view`, `conta.seguranca:view`

**Escopo** por par (modulo, acao):

- `todos` — enxerga tudo do `correspondente_id`.
- `equipe` — enxerga próprios + de subordinados diretos.
- `proprios` — só os próprios (inclui `cliente_parceiros` quando aplicável).
- `personalizado` — usa `permission_escopo_alvos` para listar quem/o quê é visível.

Toda listagem no sistema aplica escopo via `usuario_escopo_dados(uid, modulo)`. Nunca `SELECT *` sem escopo.

## 7. Segurança em camadas

1. **RLS** ativa em TODA tabela de negócio, com policy que combina `correspondente_id` + `has_role(auth.uid(), ...)` + escopo.
2. **`SECURITY DEFINER`** com `SET search_path = public` em toda função de agregação/permissão.
3. **Server fns** com `requireSupabaseAuth` para tudo autenticado; `supabaseAdmin` só via `await import()` dentro do handler, após verificar role via `context.supabase.rpc('has_role', ...)`.
4. **Rate-limit** no login (5 tentativas / 15min / IP), no signup (mesmo teto), no OTP e-mail de simulação (5/15min/e-mail), no login do cliente (5/15min/documento; bloqueio 24h após 10 falhas).
5. **Auditoria** em `admin_audit_logs` para: login, logout, criar/editar/desativar pessoa, mudar acesso_tipo, resetar senha, alterar permissão, exportar relatório, acessar PII, mudar credencial de banco, disparar backup.
6. **LGPD**: banner de consentimento no primeiro acesso (interno e cliente); `cliente_auditoria` registra todo acesso a dado de cliente; tela "Meus dados" no App Cliente (baixar JSON + solicitar exclusão via demanda para DPO); consentimento explícito (`consentimento_lgpd`, `consentimento_scr`) antes de enviar dado ao banco.
7. **PII mascarada** para usuários sem `pii:view` (função `mask_pii_jsonb` + `mask_cpf` no client). Vale em tela, XLSX, PDF, logs de integração.
8. **Cookies do App Cliente**: `HttpOnly + Secure + SameSite=Lax`, TTL 8h, selados com `CLIENTE_APP_SESSION_SECRET` (≥32 chars).
9. **Segredos** nunca em código-fonte, nunca em `.env` commitado. Rotate via `add_secret`/`generate_secret`.
10. **Webhooks públicos** (`/api/public/*`) validam HMAC ou secret compartilhado. Cron `/api/public/sync-propostas` protegido por `CRON_SECRET`.

## 8. Telas desta etapa

### `/` — Landing (pública, sem menu)

3 cards empilhados: Correspondente (`/auth`), Cliente (`/portal`), Parceiro (`/parceiro`). Logo Agilliza no topo. `head()` com `robots: noindex`.

### `/auth`

- Aba **Entrar**: e-mail + senha; "Esqueci senha" usa reset nativo Supabase.
- Aba **Criar conta**: nome, e-mail, telefone, senha + confirmação, aceite LGPD → `supabase.auth.signUp` com `papel_inicial='correspondente'`.
- Redirecionamento pós-login por `acesso_tipo`. Mensagem de erro sempre genérica.

### `/portal`

- Toggle PF/PJ. Inputs: CPF (11 dig) ou CNPJ (14 dig) + data de nascimento/abertura.
- Sem "Criar conta". Rodapé: "Ainda não tem acesso? Peça ao seu correspondente."
- Chama `validarAcessoCliente(tipo, doc, data)` — verifica `cliente_portal_acessos.ativo=true`, hash bate, rate-limit OK.

### `/parceiro`

- E-mail + senha. Sem signup. Rodapé: "Ainda não é parceiro? Fale com o correspondente."
- Redireciona para `/parceiro-inicio` (dashboard reduzido, no mesmo shell interno).

### `/admin/pessoas` (3 abas)

1. **Pessoas** — lista unificada com colunas: Nome, E-mail, Tipo de acesso (`Sistema — <nível>` / `Portal do Parceiro` / `Sem acesso`), Nível interno, % comissão (se parceiro), Ativo, Última atividade, Ações. Filtros por tipo de acesso e nível. Botão **Nova pessoa**.
2. **Tipos de Pessoa** — CRUD de `tipos_pessoa` (slug obrigatório, aparece no dropdown de tipo em `profiles`).
3. **Regras & Permissões** — matriz visual (grid módulos × ações) por nível de acesso, com toggle por célula e select de escopo. Muda em tempo real (invalidação de query).

## 9. Definition of Done

- Auto-cadastro do correspondente cria `profiles` + `user_roles` + níveis padrão + tipos padrão automaticamente.
- 3 portas de entrada validam `acesso_tipo` e redirecionam corretamente.
- Cadastro em `/admin/pessoas` gera senha temporária no modal (uma única vez, com aviso).
- Matriz de permissões filtra menu em tempo real (Etapa 02 verifica).
- Escopo `proprios/equipe/todos/personalizado` funciona em todas as listagens dos módulos seguintes.
- `admin_audit_logs` grava todas as ações administrativas.
- Rate-limit funciona nos 3 portais.
- LGPD: banner exibido, consentimento persistido, "Meus dados" no App Cliente funciona.
- Reset de senha nativo do Supabase configurado com Site URL/Redirect URLs corretos.
- Zero mensagem revelando existência de e-mail/CPF nos erros de login.
- `supabase--linter` sem warning novo.
