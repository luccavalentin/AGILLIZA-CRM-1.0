# Etapa 10 — Administração, Portal do Parceiro Unificado, Integrações, Auditoria, Backup, Scan IA 2.0

> Requer 01–09.

## 1. Escopo

**Tabelas**:

- `bancos_parceiros` (seed com 5 bancos; ver `00-v2 §4`).
- `banco_credenciais` (10 col.) — só armazena **nome do secret** + ambiente (homolog/prod). Nunca o valor.
- `admin_api_integrations` (13 col.).
- `parametros_globais` (29 col.) — razão social, CNPJ, logo, cor primária, endereço, telefone SAC, e-mail DPO, políticas.
- `parceiro_detalhes` (11 col.), `cliente_parceiros` (6 col.).
- `admin_audit_logs`, `financial_audit_logs`, `task_audit_logs`, `report_audit_logs`, `cliente_auditoria`, `scan_ia_auditoria`.
- `purchase_requests` (14 col.) — "Diversos" (compras internas com aprovação).
- `scan_ia_leituras/campos_extraidos/auditoria`.
- `backup_jobs` (10 col.).
- `integracao_health_checks` (8 col.).
- `access_levels`, `permissions`, `permission_escopo_alvos`, `tipos_pessoa`.
- `configuracoes_modulos`.

## 2. Rotas administrativas

- `/admin/pessoas` — 3 abas: **Pessoas**, **Tipos de Pessoa**, **Regras & Permissões** (a rota antiga `/admin/regras-modulos` é **redirect** para `/admin/pessoas?tab=regras`).
- `/admin/bancos` — CRUD de `bancos_parceiros`; toggle ativo com validação (cadastrar credenciais + teste conectividade OK).
- `/admin/apis-ia` — seletor de provedor de IA (Gemini/OpenAI) + seleção de modelo + prompts + temperatura + cache. Chamada direta ao endpoint oficial. Segredo salvo como `GEMINI_API_KEY` ou `OPENAI_API_KEY`.
- `/admin/integracoes` — Integração Bancária: base URL, status conexão (ping `/auth/token`), refresh manual de domínios (`homefin_bancos`, `homefin_operacoes`). Health-check registrado em `integracao_health_checks`.
- `/admin/parametros` — CRUD de `parametros_globais` + `sla_configuracoes` + feriados + `configuracoes_modulos`.
- `/admin/auditoria` — consulta unificada; filtros por usuário (Combobox pesquisável — traz TODOS os usuários), entidade (nomes amigáveis das telas, não da tabela), tipo de operação (Combo pesquisável), período. Export CSV.
- `/admin/backup` — dispara backup completo (SQL dump + storage manifest) para bucket seguro; retenção 90 dias.
- `/admin/compras` — Diversos (`purchase_requests`) com aprovação + integração com CP quando aprovado.
- `/admin/notificacoes` — CRUD `notificacao_regras` (evento → destinatários). Preview do template com evento real recente. Coluna do canal travada em `app` (colunas legadas ocultas).

## 3. `/admin/pessoas` (fonte única de convite — regra §5 e §6 da Etapa 01)

Lista única de usuários do mesmo `correspondente_id`. Colunas: Nome · E-mail · Tipo de acesso (badge `Sistema — <nível>` / `Portal do Parceiro` / `Sem acesso`) · Nível interno · % comissão (se parceiro) · Ativo · Última atividade · Ações.

Filtros: tipo de acesso, nível, situação.

Formulário Nova/Editar Pessoa (ver §5 Etapa 01) — inclui:

1. Dados básicos (nome, e-mail, telefone, doc, tipo_pessoa).
2. Card "Acesso":
   - Toggle Habilitar login.
   - Toggle Acesso ao Portal do Parceiro.
   - Se ligado → CRECI, razão social (PJ), logo upload, % comissão padrão, imobiliária vinculada.
   - Se desligado → dropdown Nível de acesso interno.
   - Campo Senha temporária (mín 8, gerador).
3. Modal "Copiar senha temporária" após salvar (uma única vez).
4. Ações por linha: editar, ativar/desativar (revoga sessão), reset senha, transferir carteira (parceiro), soft-delete.
5. Log em `admin_audit_logs`.

**Ações extras 2.0**:

- Botão "Auditar acesso" abre modal com todas as ações do usuário nos últimos 30d (`admin_audit_logs` filtrado).
- Coluna "Última atividade" com tooltip do IP/UA da última sessão.

## 4. Portal do Parceiro **unificado** (2.0)

Parceiro (`profiles.acesso_tipo='portal_parceiro'`) **NÃO** tem shell dedicado. Ele:

1. Loga em `/parceiro` (login público, Etapa 01).
2. Aterrissa em `/parceiro-inicio` — dashboard reduzido dentro do shell interno padrão.
3. Nav filtrada pela matriz + escopo `proprios` (inclui `cliente_parceiros`).
4. Rotas antigas `/parceiro/clientes|simulacoes|propostas|comissoes|documentos` são **redirects** para as rotas internas correspondentes.

Regra: se `acesso_tipo='portal_parceiro'` tentar `/auth` → recusa + redirect `/parceiro`. Se `acesso_tipo='sistema'` tentar `/parceiro` → recusa + redirect `/auth`.

## 5. Bancos — regras de habilitação

- Seed obrigatório com **Bradesco/Santander/Itaú** `ativo=true` + `flag_padrao=true`; **Inter/Caixa** `ativo=false`.
- Toggle "Ativar banco" exige preencher: `codigo_agencia_padrao`, `codigo_parceiro`, secrets (nome + valor via `add_secret`), rodar teste de conectividade OK.
- Todos os selects de banco no sistema consomem `vw_bancos_ativos`. **Nunca** hardcode.

## 6. Scan IA (`/crm/scan-ia` — pertence à Etapa 03, mas configurado aqui)

- Upload de doc (PDF/JPG/PNG) → server fn envia ao endpoint oficial da IA escolhida em `/admin/apis-ia`.
- Extrai campos: CPF, RG, nome, data nasc., renda, endereço, etc.
- Grava em `scan_ia_leituras` + `scan_ia_campos_extraidos`.
- Auditoria em `scan_ia_auditoria` (usuário, doc, campos extraídos, custo estimado).
- Confiança do campo colore o preview: alta ≥0.9 `bg-success/10`, média 0.6–0.9 `bg-warning/10`, baixa <0.6 `bg-destructive/10 + "revisar"`.

## 7. Regras críticas

1. **Secrets nunca no DB** — só o **nome** da env var em `banco_credenciais` ou `admin_api_integrations`. Valor via `add_secret`/`process.env.*`.
2. **Toda ação admin** loga em `admin_audit_logs` (append-only). Coluna `payload_anterior/novo` em JSONB.
3. **Backup** roda em bucket separado, retenção 90d. UI só dispara; restauração é manual documentada.
4. **Integração Bancária = polling puro** — não há webhook. Cron `/api/public/sync-propostas` protegido por `CRON_SECRET`.
5. **Rate-limit** em `/api/public/*`.
6. **Health-check** de integrações roda a cada 5min por cron → `integracao_health_checks` (status verde/amarelo/vermelho).
7. **Zero integração de e-mail/SMS/WhatsApp/push** — ignorar qualquer prompt que peça.

## 8. Segurança avançada (2.0 — reforço)

1. **RLS reforçada** em `banco_credenciais`, `admin_audit_logs`, `parametros_globais` — só correspondente/admin do próprio ecossistema.
2. **Rotação obrigatória** de secrets: `/admin/integracoes` mostra idade de cada secret; ao ultrapassar 90d, badge amarelo + prompt de rotação. `SUPABASE_SERVICE_ROLE_KEY` sinalizado como "gerenciado".
3. **2FA** (roadmap) — preparado no schema (`profiles.mfa_enabled`, `profiles.mfa_secret_hash`); habilitação em `/conta/seguranca`.
4. **Sessão administrativa curta** — mudanças críticas (`role.grant`, `pessoa.acesso.migrar`, `bancos.credenciais.edit`, `backup.disparar`) exigem re-autenticação (reprompt de senha) na hora.
5. **Detecção de anomalias** — log com heurística simples (login de IP novo, N ações admin em 5min, export massivo) → notifica correspondente.
6. **Backup criptografado** — payload no bucket com AES-GCM usando chave separada (`BACKUP_ENCRYPTION_KEY`).

## 9. Aparência

- Matriz de permissões: célula permitida `bg-success/10 text-success + Check`; bloqueada `bg-muted text-muted-foreground + Minus`; alterada não salva `border-warning + Dot text-warning`.
- Status integração: verde `success + timestamp`; amarelo `warning "Degradado" (>30% falha em 100 chamadas)`; vermelho `destructive "Fora do ar" + botão "Testar conexão"`.
- Auditoria: tabela densa `text-xs tabular-nums`, ação em chip info; IP/UA em muted-foreground.
- Backup: card com ícone `Database text-primary`; status OK success / Falhou danger.
- Scan IA: área upload borda-dashed → primary em hover; progresso `bg-primary`; campos coloridos por confiança.

## 10. Definition of Done

- Admin edita matriz → usuário afetado vê menu atualizado em <5s.
- Parceiro `portal_parceiro` logado → nav reduzida + escopo próprios + `/admin/*` bloqueado.
- Ativar Inter/Caixa: sem credenciais + teste OK, botão fica bloqueado.
- Refresh de domínios do provedor bancário atualiza `homefin_bancos`.
- Backup dispara + grava manifest em `backup_jobs`.
- Auditoria: todos os usuários listados no combo; entidades com nomes amigáveis; export CSV OK.
- Scan IA extrai CPF de RG em `<10s` (Gemini), grava campos + auditoria.
- Health-check cron atualiza `integracao_health_checks` a cada 5min.
- Secret com >90d exibe badge amarelo em `/admin/integracoes`.
- Mudança crítica exige reprompt de senha.
- Zero integração externa proibida em código (`rg -n "twilio|sendgrid|resend|whatsapp"` limpo).
