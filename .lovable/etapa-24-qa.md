# Etapa 24 — QA: Documentos › Links

## Escopo real do módulo

O menu **Documentos › Links** é um **repositório de URLs úteis** (título, URL, descrição, categoria). É um _bookmark manager_ interno, **não** um gerador de "share-links de formulários" com token único, expiração, uso único e vinculação a destinatário.

O enunciado da Etapa 24 assume um fluxo de "link público de formulário → resposta preenchida pelo destinatário → resposta associada a cliente/proposta". **Esse fluxo não existe neste módulo** e — pela arquitetura atual — não deveria existir aqui: o preenchimento pelo cliente acontece no **Portal do Cliente** (autenticado por CPF/CNPJ + data + rate-limit + cookie selado, Etapa 09), o envio ao banco usa o dossiê de propostas (Etapa 18), e modelos de PDF vivem em **Documentos › Formulários** (Etapa 23).

Este checklist audita o que existe e marca o restante como **N/A — fora do escopo do módulo** ou **backlog / feature nova**.

## Correções aplicadas nesta etapa

- **Whitelist de esquema de URL** em `normalizarUrl` (`src/lib/links/links.functions.ts`): agora recusa `javascript:`, `data:`, `vbscript:`, `file:` e qualquer protocolo que não seja `http(s)`; valida com `new URL(...)` antes de gravar. Isso vale para criação e edição.
- Sanitização já existente: `trim`, tamanhos máximos (`titulo` ≤ 200, `url` ≤ 2000, `descricao` ≤ 1000, `categoria` ≤ 120), auth obrigatório em todas as server fns.

## Checklist

### Geração / gestão do link (repositório)

- [x] Cadastro (`criarLink`) com título + URL + descrição + categoria.
- [x] Edição (`atualizarLink`) e exclusão (`excluirLink`).
- [x] Listagem ordenada (`listarLinks`).
- [x] URL sempre normalizada para `http(s)`; esquemas perigosos rejeitados no servidor.

### Link único / reutilizável / expiração / revogação / reativação

- **N/A** — o registro em `links_uteis` é um bookmark permanente, sem token de acesso. Não há "link único de uso único"; qualquer pessoa com a URL de destino pode acessá-la (é o site externo apontado, não um recurso interno).
- Para revogar acesso: excluir o registro. Não há flag `ativo`/`revogado_em`.

### Identificação do destinatário / validação de acesso

- **N/A** — o link aponta para uma URL externa. A tela em si é interna ao ERP e exige autenticação (`_authenticated` layout + guard `documentos.links`).

### Formulário público / autenticado / preenchimento / salvamento / envio / confirmação / anti-duplicidade

- **N/A neste módulo.** Fluxos equivalentes que existem no sistema:
  - **Portal do Cliente** (Etapa 09) — cliente autenticado por documento + data envia documentos, aceita LGPD e conversa com a equipe.
  - **Dossiê de proposta** (Etapa 18) — anexos e envio ao banco.
  - **Documentos › Formulários** (Etapa 23) — modelos PDF por banco.

### Responsividade

- [x] Página `links-view.tsx` usa o mesmo `OpHero` e cards responsivos do restante do módulo Documentos.

### Segurança

- [x] Server functions com `requireSupabaseAuth`.
- [x] `links_uteis` com RLS ligada e políticas por correspondente (4 policies).
- [x] Whitelist de esquema http(s) no servidor (correção desta etapa) — impede `<a href="javascript:...">` proveniente de bookmark malicioso.
- [x] Categoria e título limitados; sem HTML renderizado (só `<a href={url}>`).
- [ ] `rel="noopener noreferrer" target="_blank"` obrigatório em todo `<a>` que aponte para `url` — **verificado nos consumidores atuais** e mantido; qualquer novo consumidor deve seguir a mesma regra.

### Auditoria

- [ ] Registro em `admin_audit_logs` para criar/editar/excluir link — **backlog**.
- [x] Rastro implícito por `criado_por` + `updated_at`.

### Vinculação da resposta

- **N/A** — não há "resposta"; o item é um link para site externo.

## Paridade Correspondente ↔ Parceiro

- [x] Rota única `/links` sob `_authenticated`; ambos os shells usam o mesmo componente `LinksView`.
- [x] Visibilidade e ações controladas pela matriz de permissões (`documentos.links`).

## Recomendação

Se o objetivo real é ter **share-links de formulários para clientes preencherem sem login**, isso é uma **feature nova** — não pertence a este módulo. O caminho recomendado, respeitando a arquitetura já validada, é estender o **Portal do Cliente**: emitir um deep link autenticado (magic link com token de curta duração + rate-limit) que abra uma tela dedicada de preenchimento vinculada a `cliente_id` (e opcionalmente `proposta_id`), gravando em uma nova tabela `cliente_formulario_respostas`. Isso reaproveita LGPD, auditoria de acessos (`cliente_app_acessos`) e o modelo de sessão selada em cookie HttpOnly já homologado.

## Gaps priorizados (backlog para o módulo atual)

1. Auditoria dedicada de criar/editar/excluir link (`admin_audit_logs`).
2. Flag `ativo` (soft-delete) para "revogar sem apagar histórico".
3. Verificação opcional de `HEAD` / `fetch` para status da URL (health-check on-demand).

## Feature nova (se solicitada explicitamente)

- Share-links autenticados de formulário no Portal do Cliente, com:
  token único curto, expiração configurável, uso único opcional, vinculação obrigatória a `cliente_id`/`proposta_id`, tabela de respostas com auditoria, e revogação a partir do CRM.
