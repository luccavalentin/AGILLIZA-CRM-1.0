# Portal do Parceiro guiado por permissões

## Problema atual

Hoje o Portal do Parceiro (`/parceiro/*`) é um app paralelo, separado do portal do correspondente:

- Menu fixo de 6 itens (`navParceiro`), independente da matriz de permissões.
- Páginas próprias, somente-leitura, com escopo fixo "clientes vinculados".
- Não respeita o nível de acesso (Regras & Módulos) que o correspondente configura para o parceiro.

Resultado: o correspondente não consegue definir "o que o parceiro vê ou não", nem "próprios x todos". É exatamente o "código remendado" a ser eliminado.

O portal do correspondente, por outro lado, já é 100% guiado por permissões:
- `navInterno` é filtrado por `getMinhasPermissoes` (matriz `permissions` do `nivel_acesso`).
- RLS + `usuario_escopo_dados` / `usuario_tem_acesso_*` aplicam o escopo próprios/equipe/todos.
- A tela Regras & Módulos já cria níveis de acesso com `acesso_tipo = 'portal_parceiro'`.

## Objetivo

O parceiro passa a usar **as mesmas opções e páginas** do correspondente, porém:
- Cada item de menu/módulo aparece **somente** se o nível de acesso do parceiro tiver a permissão `:view`.
- Cada listagem respeita o **escopo** (próprios/equipe/todos) definido pelo correspondente.
- Para o parceiro, **"próprios"** significa os registros dos **clientes vinculados a ele** (`cliente_parceiros`), além dos que ele mesmo criou/é responsável.

## Mudanças

### 1. Banco de dados (escopo do parceiro) — migração

Ajustar as funções SECURITY DEFINER para que, quando o usuário for parceiro (`acesso_tipo='portal_parceiro'`), o escopo "próprios" também inclua os registros ligados via `cliente_parceiros`:

- Nova função `public.cliente_vinculado_ao_parceiro(_user_id uuid, _cliente_id uuid)` → `true` se existir vínculo em `cliente_parceiros`.
- Atualizar `usuario_tem_acesso_cliente`, `usuario_tem_acesso_simulacao`, `usuario_tem_acesso_proposta` para incluir `OR cliente_vinculado_ao_parceiro(...)`.
- Atualizar as policies `SELECT` de `clientes`, `simulacoes`, `propostas` (hoje comparam só `responsavel_id`/`criador_id`) para também aceitar o vínculo de parceiro no caso escopo "próprios".
- `comissoes`: manter parceiro restrito ao seu `parceiro_id` (já é o caso); permitir `SELECT` quando `parceiro_id = auth.uid()`.

Sem novas tabelas. Apenas `CREATE OR REPLACE FUNCTION` + `CREATE/ALTER POLICY`. RLS continua ativa e mais segura (o parceiro nunca enxerga fora do seu correspondente).

### 2. Navegação unificada

- Remover `navParceiro` fixo e passar a filtrar `navInterno` também para o parceiro, usando `getMinhasPermissoes`.
- Adicionar suporte a "portal alvo" nos itens de nav: cada item declara os módulos que exige; o parceiro vê o mesmo item, apenas se tiver `:view`.
- Ocultar do parceiro os grupos que não fazem sentido para ele quando sem permissão (Administração etc. já somem por falta de permissão).

### 3. Shell/rotas do parceiro

- O parceiro continua entrando por `/parceiro` (login com marca própria), mas após autenticado passa a usar o **mesmo AppShell e as mesmas páginas** do portal interno, com o menu filtrado por permissão.
- Consolidar: as telas hoje duplicadas em `/parceiro/clientes`, `/parceiro/simulacoes`, etc. passam a redirecionar para as páginas internas equivalentes (`/crm/clientes`, `/operacional/simulacoes`, …), que já respeitam escopo. Assim não há duas implementações da mesma tela.
- Manter a tela "Início" do parceiro (resumo da carteira) como página inicial dele.

### 4. Sessão/roteamento

- `getMinhasPermissoes` já funciona para o parceiro (lê `nivel_acesso_id`), sem mudança.
- Ajustar o guard para permitir que o parceiro acesse as rotas internas permitidas, mantendo bloqueio das não permitidas.

## Técnico

- Arquivos principais: `supabase` (migração de funções + policies), `src/components/app-shell/nav-config.ts`, `src/components/app-shell/filter-nav.ts`, `src/routes/parceiro.tsx`, `src/routes/_authenticated/route.tsx`, rotas `src/routes/parceiro.*.tsx` (viram redirects/consolidam), `src/lib/parceiro/portal.functions.ts` (mantém só o resumo).
- Segurança: escopo do parceiro nunca ultrapassa o `correspondente_id`; "próprios" = vínculo em `cliente_parceiros` + autoria. `supabaseAdmin` deixa de ser necessário nas listas (passam a usar RLS do próprio parceiro), reduzindo superfície.

## Fora de escopo

- Não altera o enum `app_role` nem cria papéis novos.
- Não muda a marca/telas do App do Cliente.

## Pontos a confirmar

1. Ao unificar, o parceiro passa a navegar pelas rotas internas (ex.: `/crm/clientes`) com a marca do portal — OK manter uma única implementação de cada tela (recomendado, evita remendo)?
2. "Próprios" do parceiro = clientes vinculados em `cliente_parceiros` + os que ele criou. Confirma essa definição?
