# Etapa 01 — Fundação: Acessos, Papéis e Permissões

> Cole as **Convenções Globais** antes deste prompt.

## Dependências e Produtos (mapa de integração)
**Depende de:** `00-convencoes-globais.md` (marca branca, bancos ativos por padrão, proibição de e-mail/SMS/WhatsApp) e `00b-tons-cores-design-tokens.md` (tokens de tema).
**Produz (consumido por TODAS as etapas seguintes):**
- Tabelas: `profiles`, `user_roles` (enum `app_role`), `correspondentes`, `permissoes_gestor`.
- Coluna `correspondente_id` (ecossistema) — chave de isolamento RLS reutilizada em CRM, Simulações, Propostas, Financeiro, Tarefas, Relatórios, Admin, Portal do Parceiro, App do Cliente.
- Função `public.has_role(uuid, app_role)` — usada em **todas** as policies RLS das etapas 02–10.
- Trigger `handle_new_user_profile` que define `correspondente_id = profiles.id` no auto-cadastro do correspondente-raiz e herda `correspondente_id` + `role` em convites (usado em Etapa 02 sidebar, Etapa 10 pessoas/parceiros).
- Telas públicas **obrigatórias já nesta etapa**: `/` (landing com 3 cards: Correspondente, Cliente, Parceiro), `/auth` (login + criar conta correspondente), `/portal` (esqueleto de login do cliente PF/PJ) e `/parceiro` (esqueleto de login do parceiro). `/admin/pessoas` (convite de equipe e parceiros) também nasce aqui — Etapa 02 monta a rota interna, Etapa 10 estende a gestão.


## Assets desta etapa (pasta `Logos e a API/`)
- **Logo da tela `/auth`, cabeçalho do e-mail de convite (se houver PDF impresso) e favicon**: usar arquivos de `Logos e a API/Logo PNG/` (transparência) e `Logos e a API/Logo Vetor/AGILLIZA-LOGO.pdf` como referência para gerar o favicon SVG. Copiar as PNGs escolhidas para `src/assets/brand/` e importar via ES6. **Proibido gerar logo com IA ou usar texto estilizado no lugar da marca.**


## Como o sistema pensa acesso (leitura obrigatória, sem jargão)

Todo o sistema Agilliza gira em torno de **um único personagem central: o CORRESPONDENTE bancário**. Ele é o dono do negócio — é o profissional (ou empresa) que tem contrato com os bancos, que responde pela operação e que "abre a casa" para todos os outros usuários entrarem.

Pense assim: o correspondente é o **dono da conta Agilliza**. Todos os demais usuários (gestor, comercial, analista, parceiro imobiliário, corretor, cliente final) só existem **dentro do ecossistema de um correspondente**. Ninguém cria conta "solto" no ar — cada usuário está sempre amarrado ao correspondente que o convidou.

Consequência direta disso, que precisa estar clara no código e na UI:

- **O correspondente É QUEM CRIA e gerencia todas as outras contas do seu ecossistema.** Ele cadastra gestores, comerciais, analistas, parceiros imobiliários e corretores. Ele também vê e administra os clientes finais que qualquer um deles trouxer.
- **O "admin" da Lovable/Agilliza não é papel de operação.** Admin é apenas o superusuário técnico da plataforma (nós, mantenedores do produto). Ele existe para dar suporte, resolver bug e cadastrar novos correspondentes. Ele **não** faz parte do dia a dia comercial.
- Papéis internos (gestor, comercial, analista) são **funcionários** do correspondente. Eles herdam permissões dele, mas nunca podem ser mais fortes do que ele.
- Papéis externos (parceiro imobiliário, corretor) são **parceiros comerciais** do correspondente. Ganham acesso reduzido, apenas para trazer cliente e acompanhar a esteira daquele cliente.
- O **cliente final** é quem vai financiar o imóvel. Acessa só o Portal do Cliente / App, e enxerga somente o próprio processo.

Regra de ouro que deve ser respeitada em toda tela, endpoint e política: **quem pode criar/editar/excluir conta de outro usuário é o correspondente do ecossistema (e o gestor que ele autorizar).** Nunca esconda o botão "Criar usuário" do correspondente. Nunca peça ao admin da plataforma para cadastrar corretor.

## Papéis do sistema (nomes fixos usados no código)

| Papel (`app_role`) | Quem é na vida real | Escopo padrão | Pode criar/gerenciar contas? |
|--------------------|---------------------|---------------|------------------------------|
| `correspondente` | Dono do negócio, titular do contrato com os bancos | **Todo o ecossistema dele** (todos os clientes, simulações, propostas, financeiro, parceiros, corretores e funcionários que ele cadastrou) | **SIM — cria e gerencia todos os demais usuários do próprio ecossistema** (gestor, comercial, analista, imobiliária, corretor). Também aprova/bloqueia parceiros. |
| `gestor` | Braço direito do correspondente, gerente de equipe | Todo o ecossistema, mas com limites definidos pelo correspondente (ex.: sem financeiro) | **SIM, quando o correspondente autorizar** — pode cadastrar comercial, analista, corretor. Não pode remover o correspondente nem promover ninguém a correspondente. |
| `comercial` | Vendedor / originador de negócio | Seus próprios clientes + os da equipe dele | **Não cadastra usuários**. Só cadastra cliente final no CRM (e habilita o Portal do Cliente dele, se autorizado). Cadastro de qualquer outro tipo de usuário (gestor, analista, imobiliária, corretor) é sempre pelo correspondente ou gestor em Configurações. |
| `analista` | Analista de crédito / operacional | Propostas atribuídas a ele | Não cadastra usuário. Só trabalha em cima do que já existe. |
| `imobiliaria` | Empresa parceira (imobiliária) | Só os clientes que ela indicou | Pode cadastrar os **corretores da própria imobiliária** (subusuários dela). Não vê nada fora dos próprios indicados. |
| `corretor` | Corretor autônomo ou vinculado a uma imobiliária | Só os clientes que ele indicou | Não cadastra ninguém. |
| `cliente` | Cliente final (PF ou PJ) tomador do crédito | Só o próprio processo | Não cadastra ninguém. |
| `admin` | Suporte técnico da plataforma Agilliza/Lovable | Global, só para manutenção | Cadastra **correspondente** (raiz de um novo ecossistema). No dia a dia comercial, não aparece. |

> Se em algum lugar do sistema o botão "Novo usuário" só aparece para `admin`, isso está **errado**. O botão deve aparecer para `correspondente` sempre, e para `gestor` quando o correspondente marcou a permissão "gerenciar equipe".

## Como um ecossistema nasce e cresce

> **IMPORTANTE — leia antes de codificar:** O correspondente **SE CADASTRA SOZINHO** na tela `/auth` (aba **"Criar conta"** — nome + e-mail + telefone + senha). **NÃO é a Agilliza que precisa criar o correspondente-raiz via SQL, e NÃO existe convite prévio para ele.** Ao concluir o cadastro, o próprio Supabase envia o e-mail de confirmação e, ao logar pela primeira vez, o trigger `handle_new_user_profile` cria o `profiles` já com `role='correspondente'` e `correspondente_id = profiles.id` (aponta para si mesmo). A partir daí ele é o dono do próprio ecossistema.
>
> Depois disso, dentro do sistema, o correspondente:
> 1. **Ativa/cadastra clientes finais** pelo CRM (`/crm/clientes/novo` ou importando leads) — o cliente ganha acesso ao Portal/App do Cliente com CPF + data de nascimento.
> 2. **Cadastra todos os demais usuários** em **Configurações → Pessoas & Níveis de Acesso** (`/admin/pessoas`) — gestor, comercial, analista, imobiliária, corretor. Cada um recebe **senha temporária exibida uma única vez no modal** para o correspondente repassar manualmente (o sistema não envia e-mail). O toggle "Acesso ao Portal do Parceiro" no cadastro decide se o usuário vai logar em `/parceiro` (toggle ligado) ou em `/auth` como usuário interno com nível de acesso configurável (toggle desligado).
>
> O papel `admin` (suporte técnico da plataforma) **não** cria correspondente — ele existe apenas para manutenção. Nada de "SQL admin insere o primeiro correspondente"; o fluxo é auto-cadastro público.

```text
        Auto-cadastro público em /auth (aba "Criar conta")
                     │
                     ▼
             CORRESPONDENTE  ◄──── dono do ecossistema (criado por ele mesmo)
             │   │   │   │
             │   │   │   └──► CRM: ativa/cadastra CLIENTES FINAIS (Portal/App)
             │   │   └──────► Configurações → Pessoas: convida IMOBILIÁRIA → corretor 1, corretor 2…
             │   └──────────► Configurações → Pessoas: convida CORRETOR autônomo
             │                Configurações → Pessoas: convida COMERCIAL / ANALISTA (equipe interna)
             └──────────────► Configurações → Pessoas: convida GESTOR (cogestor de confiança)
                                         │
                                         └──► também pode convidar equipe (se autorizado)

         Cada CLIENTE final é sempre amarrado a um correspondente,
         geralmente pela porta de entrada (comercial, corretor ou imobiliária).
```

Regras importantes desse desenho:
1. **Todo usuário criado herda o `correspondente_id` de quem o convidou.** Esse campo é a "cor" do ecossistema — é o que a RLS usa para separar um correspondente do outro. Ninguém enxerga dado de outro ecossistema, ponto.
2. **O correspondente enxerga tudo do próprio ecossistema, sempre.** Financeiro, comissões, propostas de qualquer analista, cliente de qualquer corretor.
3. **Parceiros (imobiliária/corretor) só enxergam o cliente que trouxeram.** Nunca a base inteira, nunca a comissão dos outros.
4. **O admin da plataforma nunca aparece na UI comercial** (nem no menu, nem nos filtros de "responsável", nem em relatórios do correspondente).

## O que o módulo faz na prática

1. **Auto-cadastro do correspondente** em `/auth` aba **"Criar conta"** (pública, sem convite): nome, e-mail, telefone, senha. Ao confirmar, cria `auth.users` + `profiles` com `role='correspondente'` e `correspondente_id = profiles.id`. Confirmação de e-mail nativa do Supabase. **Esta é a ÚNICA forma de nascer um correspondente — não há SQL manual, não há painel do admin.**
2. **Login interno** (correspondente, gestor, comercial, analista, imobiliária, corretor) por e-mail + senha via Supabase Auth. No login, checa se o perfil está ativo; se não, desloga e volta para `/auth`.
3. **Login do cliente final** no Portal do Cliente por CPF + data de nascimento (PF) ou CNPJ + data de abertura (PJ). Sem SMS, sem e-mail, sem WhatsApp — o sistema não dispara mensagem. A sessão fica em cookie assinado, válida por 8h. **O cliente é ativado pelo correspondente no CRM** — não há auto-cadastro de cliente.
4. **Cadastro de novos usuários (equipe interna e parceiros — lista única)** feito pelo correspondente (ou pelo gestor autorizado) em **Configurações → Pessoas** (`/admin/pessoas`). Ao criar, o sistema amarra `correspondente_id = correspondente_id do criador`, grava `profiles.acesso_tipo` conforme o toggle "Acesso ao Portal do Parceiro", atribui `user_roles` e **gera senha temporária exibida uma única vez em modal** para o correspondente repassar manualmente ao usuário. **O sistema não envia e-mail de convite nem de definição de senha** — não há provedor de e-mail integrado para esse fluxo. "Esqueci minha senha" no login usa o reset nativo do Supabase.
5. **Matriz de permissões por nível de acesso**: uma tabela simples de "quem pode ver / criar / editar / excluir / exportar / aprovar cada módulo, e com qual alcance de dados (todos / equipe / próprios)". O correspondente pode ajustar essa matriz para os níveis do próprio ecossistema.
6. **Auditoria**: login, logout, troca de senha, criação/alteração de usuário, alteração de permissão, exportação de relatório, acesso a CPF/renda.
7. **LGPD**: banner de consentimento no primeiro acesso, registro em `cliente_auditoria` sempre que um dado de cliente é aberto ou editado, tela "Meus dados" no Portal do Cliente com direito de acesso/portabilidade/exclusão.

## 🔑 Quem cria cada tipo de acesso (regra ÚNICA e obrigatória — leia antes de codar qualquer tela de login)

O sistema tem **3 portas de entrada** (`/auth`, `/portal`, `/parceiro`), mas **só existe UMA forma de cada usuário aparecer no banco**. Nenhuma dessas 3 telas tem "Criar conta" — exceto a `/auth`, que é a **única** onde alguém se cadastra sozinho (o correspondente-raiz). As outras duas contas nascem sempre pela mão do correspondente/gestor. Isso precisa estar visível no código e na UI:

| Tipo de acesso | Onde loga | Como a conta nasce | Quem cria | Onde no sistema |
|----------------|-----------|-------------------|-----------|-----------------|
| **Correspondente** (dono do ecossistema) | `/auth` (aba **Criar conta**) | **Auto-cadastro público** (nome + e-mail + telefone + senha). Confirmação por e-mail nativa do Supabase. | Ele mesmo | `/auth` — única tela pública com signup |
| **Cliente final** (PF ou PJ) | `/portal` (CPF/CNPJ + data) | **Cadastrado no CRM pelo correspondente** e depois tem o **"Acesso ao Portal do Cliente" habilitado** por quem cadastrou. Sem habilitar, o cliente não consegue logar. | Correspondente ou gestor autorizado | **CRM → `/crm/clientes/novo`** e ficha `/crm/clientes/$id` (toggle "Habilitar acesso ao Portal do Cliente") — ver Etapa 03 |
| **Qualquer outro usuário** (gestor, comercial, analista, imobiliária, corretor, ou qualquer nível interno customizado) | Depende do toggle **"Acesso ao Portal do Parceiro"** marcado no cadastro (ver abaixo) | **Cadastrado em Configurações → Pessoas pelo correspondente/gestor**, com senha temporária exibida uma única vez no modal para repasse manual (não há envio de e-mail). | Correspondente ou gestor autorizado | **Configurações → `/admin/pessoas`** (lista única de pessoas) — ver Etapa 10 |

### Como o roteamento pós-login é decidido (fluxo único que vale para TODO usuário criado em Configurações)
O papel do usuário **não** decide por onde ele loga — quem decide é o toggle **"Acesso ao Portal do Parceiro"** no cadastro em `/admin/pessoas`:

- **Toggle LIGADO** → `profiles.acesso_tipo = 'portal_parceiro'`. Usuário só entra por `/parceiro` (menu reduzido, escopo restrito aos clientes que ele vinculou). Se tentar `/auth`, o backend recusa e redireciona para `/parceiro`. Campos exclusivos ficam disponíveis no cadastro (CRECI, % de comissão, imobiliária vinculada) e o papel gravado em `user_roles` é `imobiliaria` ou `corretor`.
- **Toggle DESLIGADO** → `profiles.acesso_tipo = 'sistema'`. Usuário é **usuário interno do correspondente** e loga em `/auth` (mesmo local que o correspondente-raiz). O **nível de acesso interno** é escolhido no cadastro (dropdown com os níveis do ecossistema — padrão: Gestor, Comercial, Analista + customizados definidos pelo correspondente em `/admin/regras-modulos`). Visualização e ações seguem a matriz de permissões (ver Etapa 01 → Matriz).

Não existe "aba Equipe" separada de "aba Parceiros" em Configurações. É **uma única lista** de pessoas do ecossistema, com badge visível de tipo de acesso.

**Regras que valem para as 3 telas de login (`/auth`, `/portal`, `/parceiro`):**
- `/portal` e `/parceiro` **não têm** aba "Criar conta", **não têm** link "Cadastre-se" e **não têm** botão "Registrar". Só têm login e "Esqueci minha senha".
- `/auth` **tem** aba "Criar conta" exclusiva para o papel `correspondente` — nenhum outro papel se auto-cadastra em lugar nenhum.
- Mensagem de rodapé em `/portal`: _"Ainda não tem acesso? Peça ao seu correspondente para habilitar seu Portal do Cliente."_
- Mensagem de rodapé em `/parceiro`: _"Ainda não é parceiro cadastrado? Fale com o correspondente que trabalha com você para cadastrá-lo."_
- No login: se `profiles.acesso_tipo = 'portal_parceiro'` e o usuário entrar por `/auth`, desloga e manda para `/parceiro`; se `acesso_tipo = 'sistema'` e o usuário entrar por `/parceiro`, desloga e manda para `/auth`; papel `cliente` em qualquer uma dessas duas → desloga e manda para `/portal`.

**Consequência para o CRM (Etapa 03) e para Configurações (Etapa 10):**
- No formulário de **novo cliente** (CRM) existe a seção **"Acesso ao Portal do Cliente"** com toggle "Habilitar acesso", que grava `clientes.portal_acesso_ativo = true` e insere linha em `cliente_portal_acessos` — sem esse toggle ativo, `validarAcessoCliente` em `/portal` responde "Cliente não encontrado".
- No formulário de **nova pessoa** (Configurações), o toggle "Acesso ao Portal do Parceiro" alterna dinamicamente entre os dois modos (campos de parceiro vs. dropdown "Nível de acesso interno"). Se o correspondente trocar o modo numa pessoa já existente, o sistema revoga sessões ativas e atualiza `acesso_tipo` + `user_roles` no mesmo salvamento.

Essa é a única regra de origem de conta e de roteamento no sistema. Se alguma tela sugerir outro caminho (parceiro se autocadastrando, cliente criando login, "aba Equipe" separada de "aba Parceiros", papel decidindo por onde loga em vez do toggle), está errado — remover.

## Telas



### `/` — Landing de acesso (pública, sem menu) **OBRIGATÓRIA NESTA ETAPA**
Página inicial com **três cards de acesso empilhados**, um abaixo do outro, cada um levando a uma tela de login distinta:
1. **Correspondente** → `/auth` (ícone `Building2`, subtítulo "Acesso interno").
2. **Cliente** → `/portal` (ícone `UserRound`, subtítulo "Portal do processo", cor de destaque `--alert`).
3. **Parceiro** → `/parceiro` (ícone `Handshake`, subtítulo "Portal do parceiro").

Logo Agilliza centralizada no topo. Rodapé com copyright. `head()` com `robots: noindex`. **Sem esta landing, o usuário não enxerga o caminho para Cliente e Parceiro — logo, é bloqueante nesta etapa.**

### `/auth` (pública, sem menu) — Correspondente e equipe interna
- Aba **Criar conta** (auto-cadastro do CORRESPONDENTE): nome, e-mail, telefone, senha + confirmação, aceite dos termos/LGPD. Ao submeter chama `supabase.auth.signUp` com `options.data = { full_name, telefone, papel_inicial: 'correspondente' }`. O trigger `handle_new_user_profile` lê esses campos, cria `profiles` com `correspondente_id = NEW.id` e insere `user_roles(role='correspondente')`. Mostra "Confirme seu e-mail para ativar a conta." — a confirmação é a nativa do Supabase.
- Aba **Entrar** (interno: e-mail + senha; "Esqueci senha" usa o reset nativo do Supabase).
- No login, se o papel for `imobiliaria` / `corretor` / `parceiro`, redireciona para `/parceiro` (não deixa entrar no shell interno). Se for `cliente`, desloga e manda para `/portal`.
- Mensagem de erro sempre genérica ("Dados não encontrados. Verifique as informações e tente novamente.") — nunca revelar se o e-mail/CPF existe.
- Limite de tentativa: 5 por IP a cada 15 min (login e signup).

### `/portal` (pública, sem menu) — Portal do Cliente **OBRIGATÓRIA NESTA ETAPA (esqueleto de login)**
Tela de login do cliente final com layout split (banner à esquerda, formulário à direita) e abas **Pessoa Física** / **Pessoa Jurídica**. Cada aba pede documento (CPF/CNPJ com máscara) + data (nascimento ou abertura). Botão "Acessar Portal" chama server function `validarAcessoCliente({ tipo, documento, data })` — **nesta etapa a função pode retornar erro "Cliente não encontrado" (o CRM só nasce na Etapa 03), o importante é a tela existir e estar navegável**. A implementação completa (sessão selada, cookie HttpOnly, telas internas do cliente) fica em Etapa 09.

### `/parceiro` (pública, sem menu) — Portal do Parceiro **OBRIGATÓRIA NESTA ETAPA (esqueleto de login)**
Tela de login do parceiro (imobiliária/corretor) com o mesmo layout split, formulário e-mail + senha via `supabase.auth.signInWithPassword`. Após login, verifica em `profiles.acesso_tipo` / `user_roles` se o usuário tem papel `imobiliaria` / `corretor` / `parceiro` (e **não** tem papel interno); se não tiver, desloga e mostra "Acesso restrito". Botão "Esqueci minha senha" usa `resetPasswordForEmail` com `redirectTo: origin + '/parceiro'`. Fluxo pós-login e telas do parceiro ficam nas Etapas 03–10.

> **⚠️ Não pule nenhuma destas 4 rotas nesta etapa.** Um bug frequente é o builder criar só `/auth` e deixar `/`, `/portal` e `/parceiro` para depois — o resultado é que o usuário abre o app e não encontra caminho para Cliente/Parceiro. Todas as 4 telas nascem juntas na Etapa 01.

### `/admin/pessoas` — Pessoas do meu ecossistema (equipe interna + parceiros, LISTA ÚNICA)
Apesar do prefixo `/admin/`, esta tela **é do correspondente e do gestor autorizado** — não do admin da plataforma. Título na UI: "Pessoas do meu ecossistema". Detalhamento completo da tela e formulário está na **Etapa 10**; aqui na Etapa 01 nasce apenas o esqueleto necessário para convidar o primeiro usuário e testar login.

- **Uma única lista** de pessoas (equipe interna + parceiros juntos), com badge da coluna "Acesso" mostrando `Sistema (nome do nível)` ou `Portal do Parceiro`. **Nunca criar abas separadas "Equipe" e "Parceiros"** — é a mesma lista com um filtro no topo por tipo de acesso.
- Botão **"Nova pessoa"** sempre visível para correspondente; visível para gestor quando `admin.pessoas.create = true`.
- No formulário: nome, e-mail, telefone, **toggle "Acesso ao Portal do Parceiro"** (é ele — e só ele — que decide por onde a pessoa loga; ver seção "Quem cria cada tipo de acesso" acima). Com o toggle DESLIGADO aparece o dropdown "Nível de acesso interno" (gestor/comercial/analista + níveis customizados); com o toggle LIGADO aparecem os campos de parceria (CRECI, % comissão padrão, imobiliária vinculada). O dropdown de nível **nunca** oferece `correspondente` nem `admin`.
- Ao salvar: server function `criarPessoaComAcesso(...)` cria `auth.users` via `supabaseAdmin` com `email_confirm=true` e **senha temporária gerada pelo servidor**, cria `profiles` com `correspondente_id = quem_criou.correspondente_id` + `acesso_tipo` + (se sistema) `nivel_acesso_id`, atribui `user_roles`, registra em `admin_audit_logs`, e devolve `{ email, senha_temporaria }` para o cliente exibir num **modal "Copiar senha temporária"** com aviso "Esta senha não será exibida novamente — repasse por canal seguro." **Não há envio de e-mail.**
- Ações por linha: editar, ativar/inativar, resetar senha (gera nova temporária no mesmo modal), alternar tipo de acesso (revoga sessões ativas via `supabase.auth.admin.signOut` antes de trocar `acesso_tipo`+`user_roles`), transferir carteira.

### `/admin/regras-modulos` (matriz de permissões)
- Linhas = módulos (`crm.clientes`, `operacional.simulacoes`, `operacional.propostas`, `financeiro.*`, `admin.pessoas` etc.).
- Colunas = ações (`view`, `create`, `edit`, `delete`, `export`, `approve`).
- Célula = `permitido: boolean` + `escopo_dados: todos | equipe | proprios`.
- Editável pelo correspondente para os níveis de acesso do próprio ecossistema. Nunca deixa o correspondente rebaixar o próprio nível (proteção contra "trancar-se para fora").

### `/conta/perfil`, `/conta/seguranca`, `/conta/notificacoes`
- Nome, telefone, foto. Trocar senha e habilitar 2FA (TOTP). Listar/revogar sessões.
- Notificações **apenas in-app** (sino no topbar). Se aparecer alguma opção de e-mail/SMS/WhatsApp na UI, remover — o sistema não dispara mensagem por esses canais nesta versão.

### `/cliente/logout` e `/logout` interno
- Limpa sessão e volta para `/auth`.

## Estrutura de dados (o mínimo, com a "cor" do ecossistema)

- `profiles(id = auth.users.id, correspondente_id, email, nome, telefone, foto_url, nivel_acesso_id, ativo, bloqueado_em, created_at, updated_at)`.
  - `correspondente_id` **é obrigatório** para todo usuário interno. Aponta para o `profiles.id` do correspondente-raiz do ecossistema. No próprio correspondente, `correspondente_id = id` (aponta para si mesmo). No admin da plataforma, é `NULL`.
- `access_levels(id, correspondente_id NULL, nome, descricao, ativo)` — vem semeado com níveis padrão do produto; cada correspondente pode criar níveis dele (com `correspondente_id` preenchido) sem enxergar os dos outros.
- `user_roles(id, user_id, role, UNIQUE(user_id, role))` — enum `app_role`: `admin`, `correspondente`, `gestor`, `comercial`, `analista`, `imobiliaria`, `corretor`, `cliente`.
- `permissions(id, nivel_acesso_id, modulo, acao, escopo_dados, permitido, UNIQUE(nivel_acesso_id, modulo, acao))`.
- `admin_audit_logs(id, user_id, correspondente_id, acao, entidade, entidade_id, ip, user_agent, payload_anterior JSONB, payload_novo JSONB, created_at)`.

Todas as tabelas de negócio (clientes, simulações, propostas, financeiro etc.) ganham `correspondente_id` e a RLS filtra por ele automaticamente.

## Funções `SECURITY DEFINER` obrigatórias

- `has_role(uid, role)` — checa `user_roles`.
- `has_any_role(uid, roles[])`.
- `is_correspondente(uid)` — retorna true se o usuário é o correspondente-raiz do próprio ecossistema (`profiles.id = profiles.correspondente_id` e role `correspondente`).
- `is_interno(uid)` — retorna true para `admin`, `correspondente`, `gestor`, `comercial`, `analista` (parceiros e cliente ficam de fora).
- `pode_gerenciar_pessoas(uid)` — retorna true para `admin`, para `correspondente` e para `gestor` cujo nível tenha `admin.pessoas.create = true`. **Esta é a função que libera o botão "Nova pessoa".**
- `correspondente_do_usuario(uid)` — devolve o `correspondente_id` do usuário, para RLS.
- `usuario_tem_permissao(uid, modulo, acao)` — admin/correspondente sempre `true` dentro do próprio ecossistema; senão consulta `permissions`.
- `usuario_escopo_dados(uid, modulo)` — devolve `'todos' | 'equipe' | 'proprios'` (correspondente sempre `'todos'` dentro do próprio ecossistema).
- `handle_new_user_profile()` — trigger em `auth.users` (AFTER INSERT) que cria `profiles`. **Lógica obrigatória:**
  - Se `raw_user_meta_data->>'papel_inicial' = 'correspondente'` (veio do auto-cadastro público em `/auth` aba "Criar conta"): cria `profiles` com `correspondente_id = NEW.id` (aponta para si mesmo) e insere `user_roles(user_id=NEW.id, role='correspondente')`.
  - Se `raw_user_meta_data->>'correspondente_id'` está preenchido (veio de convite feito por outro usuário do ecossistema): cria `profiles` com esse `correspondente_id` e insere `user_roles` com o `papel` também vindo do metadata.
  - Copia `full_name` e `telefone` do metadata para as colunas do `profiles`.

## RLS — o padrão que TODA tabela de negócio usa

Toda tabela `X` do negócio precisa ter uma coluna `correspondente_id` preenchida no INSERT (default = `correspondente_do_usuario(auth.uid())`).

```sql
ALTER TABLE public.X ENABLE ROW LEVEL SECURITY;

-- 1) Isolamento por ecossistema (o mais importante)
CREATE POLICY "X_isolamento_ecossistema" ON public.X FOR SELECT TO authenticated
USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- 2) Escopo dentro do ecossistema (todos/equipe/proprios)
CREATE POLICY "X_escopo" ON public.X FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND CASE public.usuario_escopo_dados(auth.uid(), '<modulo>')
    WHEN 'todos'   THEN true
    WHEN 'equipe'  THEN owner_id IN (
      SELECT membro_id FROM public.equipe_membros
       WHERE membro_id = auth.uid()
          OR equipe_id IN (SELECT equipe_id FROM public.equipe_membros WHERE membro_id = auth.uid())
    )
    WHEN 'proprios' THEN owner_id = auth.uid()
  END
);

-- 3) Escrita: só quem tem permissão e dentro do próprio ecossistema
CREATE POLICY "X_write" ON public.X FOR ALL TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.usuario_tem_permissao(auth.uid(), '<modulo>', 'edit')
)
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.usuario_tem_permissao(auth.uid(), '<modulo>', 'edit')
);
```

## LGPD (o essencial nesta etapa)

- Banner de consentimento no primeiro acesso; grava em `profiles.consentimento_lgpd_em`.
- `cliente_auditoria(cliente_id, evento, user_id, ip, created_at, payload JSONB)` — insere em toda leitura/edição de cliente.
- Função `mask_pii_jsonb(jsonb)` para mascarar CPF/renda em qualquer log.
- Endpoint `/api/public/lgpd/direitos` (assinado por HMAC) recebe pedidos de exclusão do titular e abre uma tarefa manual para o DPO.

## Server functions desta etapa

- `login`, `logout`, `refreshSession` — via SDK do Supabase, sem custom.
- `validarAcessoCliente({ tipo: 'PF'|'PJ', documento, data })` — valida cliente no Portal, respeita `habilitar_app` / `app_bloqueado` / `portal_status`, cria sessão selada e grava tentativa em `cliente_app_acessos`.
- `criarPessoaComAcesso({ nome, email, telefone, acesso_tipo, nivel_acesso_id?, dados_parceiro? })` — exige `pode_gerenciar_pessoas(auth.uid())`. Cria em `auth.users` via `supabaseAdmin` com `email_confirm=true` e **senha temporária** gerada no servidor, amarra `correspondente_id`, grava `profiles.acesso_tipo`, atribui `user_roles`, registra em `admin_audit_logs` (`acao='pessoa.criar'`) e **devolve `{ email, senha_temporaria }` para exibição one-time no modal**. Não envia e-mail. (Substitui a antiga `convidarUsuario`.)
- `atualizarUsuario`, `inativarUsuario`, `resetarSenha`, `transferirCarteira` — mesma proteção.
- `updatePermissoes(nivel_acesso_id, matriz)` — só correspondente/gestor autorizado, transacional. Impede rebaixar o próprio correspondente.

## Middlewares

- `requireSupabaseAuth`: valida bearer via `auth.getUser(token)`, carrega `profiles`, rejeita se `ativo=false` ou `bloqueado_em IS NOT NULL`. Devolve `{ supabase, userId, claims, profile, correspondenteId }` em `context`.
- `requireClienteSession`: idem para o Portal do Cliente.
- `attachSupabaseAuth` em `src/start.ts` para anexar o Authorization automaticamente.

## Regras críticas (checar antes de dar por pronto)

- **O correspondente NASCE por auto-cadastro público em `/auth` (aba "Criar conta").** Não existe rota de admin da plataforma para "criar correspondente", não se pede pro usuário fornecer e-mail para inserção via SQL, não há painel de admin no fluxo comercial. Se a IA sugerir "me passe o e-mail para eu inserir o correspondente-raiz", está errado — a resposta correta é "acesse `/auth` e clique em Criar conta".
- **Clientes finais NÃO se auto-cadastram.** Quem ativa o cliente é o correspondente pelo CRM. Depois o cliente acessa o Portal com CPF + data de nascimento.
- **Parceiros e equipe interna (gestor/comercial/analista/imobiliária/corretor) são criados na MESMA lista única `/admin/pessoas`** ("Configurações → Pessoas") pelo correspondente ou pelo gestor autorizado. **Sem envio de e-mail** — a senha temporária aparece uma única vez em modal, e o correspondente repassa manualmente. Por onde a pessoa loga é decidido pelo toggle "Acesso ao Portal do Parceiro", não pelo papel.

- O botão **"Nova pessoa"** aparece para `correspondente` e para `gestor` autorizado. **Nunca esconder do correspondente.**
- O menu **"Pessoas & Níveis de Acesso"** aparece para todo mundo que passa em `pode_gerenciar_pessoas(uid)`.
- O dropdown de papéis no formulário de convite **nunca** oferece `correspondente` nem `admin` para outros usuários — esses papéis só são atribuíveis pela camada de suporte da plataforma.
- Toda listagem, relatório, kanban e filtro respeita o `correspondente_id` do usuário logado — a RLS já corta, mas os fetchers precisam pedir apenas as colunas seguras.
- Rota `_authenticated/*` tem `beforeLoad` que valida sessão, redireciona `/auth` se ausente, valida perfil ativo, carrega permissões do nível e injeta em `context.permissions` (usado pelo menu).
- **Nunca** chamar server function protegida em `loader` de rota pública — quebra o prerender.

## Definition of Done da etapa

- Login interno (todos os papéis) e Portal do Cliente funcionando com SSR.
- Correspondente recém-criado consegue: entrar, abrir `/admin/pessoas`, convidar gestor/comercial/analista/corretor/imobiliária, ver todos aparecerem na lista dele e **não** aparecerem para outro correspondente.
- Gestor com `admin.pessoas.create=true` também consegue convidar; com a flag desligada, o botão some.
- Analista com escopo `proprios` não consegue `SELECT` em simulação de outro dono (teste SQL + E2E).
- Nenhum papel dentro do ecossistema consegue enxergar dado de outro ecossistema, mesmo forçando query.
- Auditoria grava: login, logout, convite de usuário, alteração de permissão, exportação de relatório.
- `mask_pii_jsonb` aplicada em todos os logs (integração bancária inclusive).
- E2E: login, logout, sessão expirada → redireciona, tentativa de acesso a rota sem permissão → 403, tentativa de trocar `correspondente_id` via API → bloqueada pela RLS.
