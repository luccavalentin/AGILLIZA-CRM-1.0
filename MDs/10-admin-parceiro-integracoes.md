# Etapa 10 — Administração, Portal do Parceiro, Integrações, Auditoria, Backup

> Requer todas as anteriores.

## Dependências e Produtos
**Depende de:** 00, 00b, **01–09**. Em particular: **01** (papéis, `has_role`, `correspondente_id`, `/admin/pessoas`), **03** (parceiros aparecem como pessoas/empresas), **04/05** (usa `logs_integracao` e webhooks HomeFin para monitor de conectividade), **06** (regras de comissão por parceria).
**Produz (fecha o ciclo e é consumido em runtime por 04, 05, 06, 09):**
- Tabelas: `banco_credenciais` (client_id/secret, ambiente homolog/prod — lidas pelas Etapas 04/05 no runtime, sobrepondo `.env`), `parceiros` (imobiliária/corretor externo com % de comissão consumido por 06), `parametros_globais`, `auditoria` (append-only de eventos das Etapas 01–09), `backup_jobs`.
- Telas: `/admin/bancos` (ativar/desativar, testar conectividade), `/admin/webhooks`, `/admin/parametros`, `/admin/auditoria`, `/admin/backup`, `/parceiro/*` (Portal do Parceiro reutilizando componentes da Etapa 08 com filtro por `parceiro_id`).
- **Não** cria integração de e-mail/SMS/WhatsApp — proibido.


## Assets desta etapa (pasta `Logos e a API/`)
- **Tela de teste de conectividade do provedor de integração bancária** deve validar contra os endpoints definidos em `Logos e a API/APIS/4 - swagger-output 29012026.json` (health check + `/oportunidades` GET com filtro vazio). Documentação de apoio: `Logos e a API/APIS/2 - Documentacao API Homefin.pdf`.
- **Portal do Parceiro** usa a mesma marca Agilliza em `Logos e a API/Logo PNG/` (sidebar reduzida + tela de login). Se o parceiro tiver logo própria (imobiliária), ela é enviada via upload no cadastro do parceiro; a Agilliza permanece como marca do sistema no rodapé.
- **Cabeçalhos de relatórios exportados (PDF)** de auditoria/backup usam a versão horizontal da logo Agilliza (`Logos e a API/Logo PNG/`).


## Objetivo
Ferramentas de gestão do sistema: cadastros mestres, integrações externas realmente existentes (provedor de integração bancária e provedor de IA apenas), auditoria completa, backup, parâmetros globais, e o **Portal do Parceiro** (imobiliárias/corretores externos com menu reduzido). **Não existe integração com provedor de e-mail, SMS ou WhatsApp** — qualquer instrução que peça isso deve ser ignorada.

## 🔑 Configurações → Pessoas é a ÚNICA porta de entrada de TODO usuário (exceto o correspondente-raiz e o cliente final)
Não existe autocadastro em `/parceiro` nem em `/auth` para ninguém além do correspondente-raiz (ver Etapa 01 → "Quem cria cada tipo de acesso"). Todo usuário — seja gestor, comercial, analista, imobiliária ou corretor — **nasce aqui**, cadastrado pelo correspondente (ou por gestor autorizado).

Cliente final **não** é cadastrado aqui — cliente é sempre pelo CRM (Etapa 03). Se o admin tentar criar uma pessoa com papel `cliente`, o formulário bloqueia e redireciona para `/crm/clientes/novo`.

### Regra de roteamento pós-login (única fonte da verdade)
O que decide **por onde o usuário loga** NÃO é o papel dele — é o toggle **"Acesso ao Portal do Parceiro"** marcado neste formulário:

- **Toggle LIGADO** → usuário só pode logar em `/parceiro` (Portal do Parceiro, menu reduzido, escopo restrito aos clientes que ele vinculou). Se tentar `/auth`, o sistema recusa e redireciona para `/parceiro`. Marca `profiles.acesso_tipo = 'portal_parceiro'`.
- **Toggle DESLIGADO** → usuário loga em `/auth` como usuário interno do correspondente. **O "tipo de usuário" (nível de acesso interno) é definido neste mesmo formulário**, no dropdown "Nível de acesso" (gestor, comercial, analista, ou qualquer nível customizado que o correspondente tenha criado em `/admin/regras-modulos`). A visualização e o que ele pode fazer seguem exatamente o que a matriz de permissões (Etapa 01) diz para aquele nível. Marca `profiles.acesso_tipo = 'sistema'`.

Não existe "aba Equipe" separada de "aba Parceiros". É **uma única lista de pessoas do ecossistema**, com a coluna "Acesso" mostrando um badge `Portal do Parceiro` ou `Sistema (nome do nível)`, e um filtro no topo por tipo de acesso. Se o correspondente mudar o toggle depois, o sistema revoga a sessão ativa e obriga o usuário a logar pelo portal correto no próximo acesso.

## Sub-módulos

### 1. `/admin/pessoas` — Pessoas & Níveis de Acesso do meu ecossistema
Lista única de `profiles` do mesmo `correspondente_id`. Colunas: nome, e-mail, telefone, **Acesso** (badge `Portal do Parceiro` / `Sistema — <nível>` / `Sem acesso`), **Nível interno** (só quando acesso = Sistema), **% comissão** (só quando acesso = Portal do Parceiro), ativo, última atividade, ações. Filtros no topo: tipo de acesso (Sistema / Portal do Parceiro / Sem acesso), nível interno, situação.

Formulário de "Nova pessoa" (e edição):
1. **Dados básicos**: nome, e-mail, telefone, documento (CPF/CNPJ). Herda `correspondente_id` do criador.
2. **Card "Acesso do usuário"** (obrigatório):
   - Toggle **"Habilitar login"** (default `false` — permite pré-cadastrar sem liberar login).
   - Toggle **"Acesso ao Portal do Parceiro"** (default `false`) — é ele que decide o roteamento (ver regra acima). Só aparece se "Habilitar login" estiver ligado.
   - Se **"Acesso ao Portal do Parceiro" = LIGADO**: aparecem campos exclusivos de parceiro — CRECI, razão social (se PJ), logo do parceiro (upload opcional), **% de comissão padrão** (consumido pela Etapa 06), imobiliária vinculada (se corretor de uma imobiliária já cadastrada). O papel gravado em `user_roles` é `corretor` (default) ou `imobiliaria` (se PJ marcado). O dropdown de "Nível interno" fica desabilitado.
   - Se **"Acesso ao Portal do Parceiro" = DESLIGADO**: aparece o dropdown **"Nível de acesso interno"** (obrigatório) — lista os níveis do ecossistema definidos em `/admin/regras-modulos` (padrão: Gestor, Comercial, Analista + os customizados do correspondente). O papel em `user_roles` é derivado do nível escolhido. Os campos de parceiro (CRECI, comissão etc.) ficam ocultos.
   - Campo **"Senha temporária"** (obrigatório quando "Habilitar login" ligado, mínimo 8 caracteres, gerador automático ao lado) — vale para os dois modos.
3. Ao salvar com login habilitado: server function `criarPessoaComAcesso({...})` via `supabaseAdmin` cria `auth.users` (`email_confirm=true`), `profiles` (com `correspondente_id`, `acesso_tipo`, `nivel_acesso_id`), `user_roles(role=...)` e — se Portal do Parceiro — os campos de parceria. Ao finalizar, abre **modal "Copiar senha temporária"** com e-mail + senha em campo monoespaçado, botão "Copiar" e aviso "**Esta senha não será exibida novamente. Repasse ao usuário por um canal seguro fora do sistema.**" O sistema **não envia e-mail** (não há provedor integrado).
4. Se "Habilitar login" desligado: só cria `profiles`. Botão **"Ativar login"** aparece na linha para gerar `auth.users` depois.
5. **Trocar o modo de acesso depois** (Portal do Parceiro ↔ Sistema): ao alternar o toggle numa pessoa já existente, o formulário exige confirmação, revoga todas as sessões ativas do usuário (`supabase.auth.admin.signOut`), atualiza `acesso_tipo` + `user_roles`, e loga em `admin_audit_logs` (`acao='pessoa.acesso.migrar'`).
6. **Ações por linha**: editar, ativar/desativar login (revoga sessão), resetar senha (gera nova temporária no modal), transferir carteira (só para parceiros), excluir (soft delete).
7. **Log obrigatório** em `admin_audit_logs` com `acao ∈ {pessoa.criar, pessoa.acesso.habilitar, pessoa.acesso.revogar, pessoa.acesso.migrar, pessoa.senha.reset, pessoa.editar}`.

Reflexo em outras etapas: Etapa 01 (login em `/auth` e `/parceiro`) obedece estritamente `profiles.acesso_tipo` para permitir ou recusar a entrada; Etapa 02 (shell/menu) monta o menu conforme `acesso_tipo` (`sistema` = shell interno completo filtrado pelo nível; `portal_parceiro` = shell reduzido `/parceiro/*`); Etapa 03 (CRM) mostra na aba "Vínculos" os parceiros (`acesso_tipo='portal_parceiro'`) cadastrados aqui; Etapa 06 (Comissões) usa o `% de comissão padrão` do parceiro; Portal do Parceiro `/parceiro/*` (abaixo) só deixa entrar quando `acesso_tipo='portal_parceiro'` e `ativo=true`.

### 2. `/admin/regras-modulos` — matriz de permissões (ver Etapa 01)

### 3. `/admin/bancos`, `/admin/apis-bancos`
- CRUD de `bancos_parceiros` (nome, código Febraban, logo, produtos aceitos, contatos, `ativo`, `flag_padrao`, `ordem`).
- **Seed obrigatório** (ver `00-convencoes-globais.md → Bancos parceiros`): a migration inicial insere 5 registros — **Bradesco, Santander, Itaú** com `ativo=true` e `flag_padrao=true`; **Inter, Caixa** com `ativo=false` e `flag_padrao=false` (pré-cadastrados aguardando homologação).
- Tela lista os 5 sempre. Bancos com `ativo=false` aparecem em `opacity-60` com badge `Aguardando homologação` (`variant="secondary"`) e toggle **"Ativar banco"**. Ativar exige, no mesmo modal: `codigo_agencia_padrao`, `codigo_parceiro`, credenciais do banco (armazenadas como secrets nomeados) e checkbox "Teste de conectividade OK" (rodar `/admin/integracoes/testar-banco/{codigo}` antes de habilitar o toggle).
- Config API por banco: base URL, credenciais (guardadas como secrets, referenciadas por nome), `ativo`, `flag_padrao` (usado como default nos multi-selects de Simulação/Proposta).
- Todos os seletores de banco do sistema consomem a view `vw_bancos_ativos` — **nunca hardcode** a lista de bancos em código.

### 4. `/admin/apis-ia`
- Config Gemini (`GEMINI_API_KEY`), prompts, temperatura.
- Usado por Scan IA (OCR de documentos → extração de campos).

### 5. `/admin/integracoes`
- **Provedor de integração bancária** (única integração externa de negócio, identificador interno HomeFin): base URL, secrets (nomes: `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`), status de conexão (ping em `/auth/token`), refresh manual de domínios (bancos/operações).
- **Webhook do provedor de integração**: URL pública `/api/public/homefin/callback`, secret HMAC validado no handler.
- Não listar Twilio, Brevo, Resend, SendGrid, WhatsApp Business ou qualquer outro provedor — não fazem parte do projeto.

### 6. `/admin/comissoes`
- CRUD de `comissao_regras` (banco × produto × faixa × %).
- Simulador: “dado proposta X, quanto pagará?”.

### 7. `/admin/sla`
- CRUD de `sla_configuracoes` e `demanda_sla_config`.
- Feriados nacionais/regionais.

### 8. `/admin/notificacoes`
- CRUD de `notificacao_regras` (evento → público-alvo → template). Como só existe o canal in-app, a coluna do canal fica travada em `app`; colunas legadas `canal_email`/`canal_whatsapp` são mantidas por compatibilidade de schema porém ficam sempre `false` e ocultas na UI.
- Preview do template renderizado a partir de um **evento real recente** escolhido pelo admin (dropdown com últimas 20 ocorrências do evento), nunca com dados inventados. Se não houver evento, botão de preview fica desabilitado com aviso "aguardando primeiro evento real".

### 9. `/admin/auditoria`
- Consulta `admin_audit_logs`, `financial_audit_logs`, `task_audit_logs`, `report_audit_logs`, `cliente_auditoria`, `envolvidos_audit_logs`, `scan_ia_auditoria`.
- Filtros por usuário, entidade, período, ação.
- Export CSV.

### 10. `/admin/backup`
- Trigger export completo (SQL dump + storage manifest) para bucket seguro.
- Última execução, tamanho, status.
- Restauração é manual (documentada); UI só dispara backup.

### 11. `/admin/configuracoes`
- `parametros_globais`: nome empresa, CNPJ, logo, cor primária, endereço, telefone SAC, política LGPD, política privacidade, e-mail DPO.

### 12. `/admin/lista-compras`
- `purchase_requests`: solicitações de compra interna com aprovação (`aprovador_id`), integra com Contas a Pagar ao aprovar.

### 13. Scan IA (`/crm/scan-ia/*`)
- Upload de doc → Gemini extrai campos → grava em `scan_ia_leituras` + `scan_ia_campos_extraidos`.
- Botão inline nas telas de cliente/proposta para escanear e pré-preencher.

## Portal do Parceiro (`/parceiro/*`)
Shell próprio (`nav-config` reduzido):
- **Meus clientes** (só vinculados via `cliente_parceiros`).
- **Simulações** (criar/consultar as próprias).
- **Propostas** (acompanhar as próprias).
- **Comissões** (só as próprias, split parceiro).
- **Documentos** (upload).

Regras:
- `beforeLoad` do `/parceiro/*` valida `role IN (imobiliaria, corretor)`. Se não, redireciona `/`.
- Zero acesso a admin, financeiro completo, dados de outros clientes.
- Menu filtrado pela matriz de permissões (mesmo mecanismo, com `nivel_acesso` específico).

## Estrutura de dados
- `bancos_parceiros`, `admin_api_integrations`, `parametros_globais`, `admin_audit_logs`, `purchase_requests`, `scan_ia_*`.

## Regras críticas
1. Secrets NUNCA gravados no DB; apenas o **nome** da variável de ambiente.
2. Toda ação admin loga em `admin_audit_logs`.
3. Backup em bucket separado com retenção 90 dias.
4. Webhook do provedor de integração valida HMAC antes de processar.
5. Rate-limit em endpoints públicos (`/api/public/*`).

## Definition of Done
- Admin edita matriz → usuário afetado vê menu atualizado no próximo request.
- Parceiro logado só vê os 5 itens do menu; tentar URL admin → 403.
- Webhook do provedor de integração com HMAC inválido → 401.
- Backup executa e grava manifesto.
- Auditoria mostra quem editou o quê e quando.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Telas de administração**: mesmo shell das internas, com breadcrumb "Administração › …" em `text-muted-foreground text-xs uppercase tracking-wide`.
- **Matriz de permissões** (`/admin/regras-modulos`)
  - Célula permitida: `bg-success/10 text-success` + ícone `Check`.
  - Célula bloqueada: `bg-muted text-muted-foreground` + ícone `Minus`.
  - Célula alterada não salva: borda `border-warning` + ícone `Dot text-warning`.
  - Coluna do módulo em `text-foreground font-medium`; escopo (todos/equipe/próprios) como chip `tone="info"`.
- **Status de integração** (`/admin/integracoes`)
  - Verde `bg-success text-success-foreground` "Conectado" + timestamp do último ping.
  - Amarelo `bg-warning text-warning-foreground` "Degradado" (>30% de falha nas últimas 100 chamadas).
  - Vermelho `bg-destructive text-destructive-foreground` "Fora do ar" — mostra também botão "Testar conexão" `variant="outline"`.
- **Auditoria** (`/admin/auditoria`): tabela densa `text-xs tabular-nums`, ação em chip `tone="info"` (`login`, `export`, `role.grant`), IP e user-agent em `text-muted-foreground`.
- **Backup** (`/admin/backup`): último export em card `bg-card border border-border`, ícone `Database text-primary`; status "OK" tone `success`, "Falhou" tone `danger`.
- **Portal do Parceiro** (`/parceiro/*`)
  - Sidebar reduzida com o mesmo esquema de cor (branca em light, gradiente azul em dark).
  - Cabeçalho da tela mostra selo da imobiliária/corretor (`bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs`) para reforçar o escopo restrito.
  - Nenhum item destrutivo global no menu do parceiro; ações destrutivas ficam por linha (`variant="ghost"` com ícone `Trash2 text-destructive`).
- **Scan IA** (`/crm/scan-ia/*`)
  - Área de upload: borda `border-dashed border-border` que vira `border-primary` em hover.
  - Progresso do OCR: barra `bg-primary`.
  - Campo extraído com alta confiança (≥0.9): fundo `bg-success/10`; média (0.6–0.9): `bg-warning/10`; baixa (<0.6): `bg-destructive/10` + aviso "revisar".
