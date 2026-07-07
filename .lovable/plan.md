# Tipo de pessoa + cadastro com ou sem login

## Objetivo
No cadastro de Pessoas, adicionar um seletor de **Tipo de pessoa** (Usuário, Imobiliária, Corretor). Para **Imobiliária** e **Corretor**, o e-mail e o acesso (login) passam a ser **opcionais**:
- **Com login:** acessa o Portal do Parceiro normalmente.
- **Sem login:** aparece nas buscas de pessoas do sistema (para vincular como responsável/parceiro), mas não consegue entrar. O correspondente pode **habilitar o login depois**.

Também melhorar a edição de permissões: manter os níveis padrão editáveis (já clonam automaticamente ao salvar) e adicionar um **"Selecionar todos"** global na matriz.

## Abordagem técnica (invariante preservada)
O sistema inteiro assume `profiles.id == auth.uid()` (RLS, sessão, vínculos). Para não quebrar isso, **toda pessoa continua tendo um registro em `auth.users`** — inclusive as "sem login". A diferença é que a pessoa sem login é criada **banida** no Auth e marcada como `login_habilitado = false`, então aparece nas listagens/buscas (que leem `profiles`) mas não consegue autenticar. Habilitar depois = definir e-mail real + senha + desbanir.

Isso evita mexer na FK `profiles → auth.users` e no remapeamento de todas as tabelas que referenciam `profiles.id`.

## Banco de dados (migração)
Na tabela `public.profiles`:
- `tipo_pessoa text NOT NULL DEFAULT 'usuario'` — valores: `usuario`, `imobiliaria`, `corretor`.
- `login_habilitado boolean NOT NULL DEFAULT true`.
- Backfill: registros existentes ficam `login_habilitado = true` e `tipo_pessoa = 'usuario'` (parceiros existentes podem ser ajustados manualmente depois).

Atualizar a trigger `handle_new_user_profile` para gravar `tipo_pessoa` e `login_habilitado` a partir do `user_metadata` (com defaults).

## Servidor (`src/lib/admin/pessoas.functions.ts`)
- `criarSchema`: e-mail vira **opcional**; adicionar `tipo_pessoa` e `com_login` (boolean). Validação: se `com_login` = true, e-mail é obrigatório e válido; `usuario` sempre exige login.
- `criarPessoaComAcesso`:
  - Com login: fluxo atual (createUser com e-mail real, senha provisória, `login_habilitado = true`).
  - Sem login: `createUser` com e-mail sintético (`semlogin+<uuid>@parceiro.local`) e senha aleatória; em seguida `updateUserById(..., { ban_duration: '876000h' })`; grava `login_habilitado = false`, `email = null`, `tipo_pessoa`. Não retorna senha (não há acesso).
  - Gravar `tipo_pessoa` em `profiles` após a criação.
- Nova server fn `habilitarLoginPessoa({ id, email })`: valida permissão e ecossistema, define e-mail real no Auth + `profiles.email`, gera senha provisória, desbane, `login_habilitado = true`; retorna a senha (exibida uma vez). Auditoria `pessoa.habilitar_login`.
- `atualizarSchema`/`atualizarPessoa`: passar a aceitar/editar `tipo_pessoa`.
- `listarPessoas`/`PessoaLista`: incluir `tipo_pessoa` e `login_habilitado`.

## UI
`src/components/admin/nova-pessoa-inline.tsx`:
- Novo seletor **Tipo de pessoa** (Usuário / Imobiliária / Corretor) no topo.
- Toggle **"Terá acesso ao portal (login)"** — visível/opcional apenas para Imobiliária e Corretor; forçado ligado para Usuário.
- E-mail: `required` apenas quando com login; label muda para "E-mail (opcional)" quando sem login.
- Enviar `tipo_pessoa` e `com_login` no payload.
- Matriz de permissões: adicionar botão global **"Selecionar todos / Limpar"** que marca/desmarca todas as ações de todos os módulos.

`src/routes/_authenticated/admin.pessoas.tsx` (lista) e `EditarPessoaDialog`:
- Exibir o tipo de pessoa (badge) e, para pessoas **sem login**, um botão **"Habilitar login"** que abre um pequeno diálogo pedindo o e-mail e chama `habilitarLoginPessoa`, mostrando a senha provisória gerada.
- Editar `tipo_pessoa` no diálogo de edição.

## Fora de escopo
- Envio de e-mail/convite automático (o correspondente repassa a senha manualmente, como já é hoje).
- Vínculo automático corretor→imobiliária (mantém apenas se já existir; pode ser tratado depois).
