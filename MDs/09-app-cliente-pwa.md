# Etapa 09 — App do Cliente (PWA autenticado)

> Requer Etapas 01, 03, 05.

## Dependências e Produtos
**Depende de:** 00, 00b, **01** (login do cliente por CPF/CNPJ+data, papel `cliente`, RLS restringindo linhas a `cliente.user_id = auth.uid()`), **03** (`clientes`, `documentos`, `pipeline_stages` para timeline visível), **05** (`propostas`, `proposta_status_historico` para acompanhamento), **07** (opcional — `tarefas` que o cliente precisa concluir, ex.: assinar contrato), **06** (opcional — mostra parcela/valores homologados).
**Produz (consumido por 10 — auditoria de acessos):**
- Rotas `/cliente/*` (PWA autenticado), `public/manifest-cliente.webmanifest`, ícones PWA.
- Server fns: `clienteMinhasPropostas`, `clienteMeusDocumentos`, `clienteEnviarDocumentoPendente`.
- Registros de acesso do cliente em `auditoria` (Etapa 10).


## Assets desta etapa (pasta `Logos e a API/`)
- **Ícones do PWA** (`192x192`, `512x512`, maskable, apple-touch-icon), **splash screen** e **logo do topo do app cliente**: gerar a partir de `Logos e a API/Logo Vetor/AGILLIZA-LOGO.pdf`/`.ai` (para nitidez) e das versões quadradas em `Logos e a API/Logo PNG/`. Salvar em `public/icons/cliente/` e referenciar em `public/manifest-cliente.webmanifest`. **Proibido gerar ícone com IA ou usar emoji.**


## Objetivo
Portal para o cliente final acompanhar seu processo: ver etapa atual, receber mensagens do time, subir documentos solicitados, conversar por chat, ver notificações in-app. Isolado do sistema interno — usa sessão selada em cookie HttpOnly, jamais Supabase Auth. **Não integra provedor de SMS, e-mail, WhatsApp nem Web Push** — não existe canal externo de mensageria no projeto.

## O que o módulo faz
1. Login em `/auth` aba **Portal do Cliente**: seleciona PF ou PJ, informa CPF+data de nascimento (PF) ou CNPJ+data de abertura (PJ). A validação bate contra o cadastro em `clientes` — não há código enviado por SMS/e-mail. Cookie selado (`agz_cliente_app`), TTL 8h.
2. Ao logar, redireciona para `/cliente/visao-geral`.
3. Cliente vê: **etapa atual** (com nome amigável e mensagem padrão), **próximas etapas** (cinza), **etapas concluídas** (verde com data), **SLA countdown** (dias/horas restantes na etapa).
4. Recebe mensagens dinâmicas do time em **chat** com histórico persistido.
5. Sobe documentos solicitados (com câmera ou galeria no mobile).
6. Vê **notificações in-app** (badge no sino, atualizado por realtime Supabase). Sem push, sem SMS, sem e-mail.
7. Consegue solicitar direitos LGPD (baixar meus dados, excluir) — a solicitação abre uma demanda interna para o DPO.
8. Instalável como PWA (manifest + service worker de shell offline). O service worker NÃO registra push subscriptions.

## Telas

### `/cliente/visao-geral` — home
- Header: nome cliente, foto, botão sair, sino.
- Card grande **Etapa Atual**: nome, descrição amigável (mensagem padrão), progresso (X/12), SLA countdown.
- Timeline visual 12 etapas (concluídas verde ✓, atual destaque, próximas cinza).
- Cards: **Próximas ações** (docs a enviar), **Últimas mensagens**, **Meu contato** (responsável no time).

### `/cliente/acompanhar-minha-proposta` (tab principal)
Tabs:
1. **Meu processo** — timeline detalhada + descrição de cada etapa.
2. **Documentos** — lista com status (pendente/enviado/aprovado/reprovado); botão “Enviar/Substituir” (câmera mobile).
3. **Mensagens** — chat com o time (`cliente_app_mensagens`), input com anexo, indicador digitando.
4. **Propostas** — cards de propostas ativas (número, banco, valor, status amigável).

### `/cliente/logout`
Limpa cookie e redireciona `/auth`.

## Estrutura de dados
- `cliente_app_acessos(cliente_id, documento, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent, created_at)` — log/rate-limit; NÃO guarda código, pois não há envio de código.
- `cliente_app_processos(id, cliente_id, proposta_id UNIQUE, etapa_atual, proxima_etapa, status_amigavel, descricao_status, banco, produto, ultima_atualizacao_em)`.
- `cliente_app_etapas(processo_app_id, cliente_id, etapa, ordem, status_etapa enum(atual|concluida|proxima|aguardando), descricao_cliente, iniciada_em, concluida_em)`.
- `cliente_app_historico(processo_app_id, cliente_id, usuario_id, tipo_evento, titulo, descricao, visivel_cliente)`.
- `cliente_app_mensagens(processo_app_id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em)`.
- `cliente_app_notificacoes(cliente_id, tipo, titulo, corpo, link, lida)`.
- `cliente_app_documentos` (equivalente ao `proposta_documentos` filtrado ao cliente).
- `cliente_portal_acessos` (log de acesso).

## Server functions (contratos)
```ts
validarAcessoCliente({ tipo: 'PF'|'PJ', documento, data }) → seta cookie selado; retorna { cliente, processos }
logoutCliente() → limpa cookie
getSessaoCliente() → { cliente } | null   // usado no layout
clienteObterVisaoGeral() → { processo, etapas, mensagens_nao_lidas, alertas }
clienteObterProcesso({ proposta_id }) → detalhe
clienteEnviarMensagem({ processo_id, mensagem, anexo? })
clienteMarcarLida({ mensagem_ids[] })
clienteUploadDocumento({ processo_id, tipo, parte, file })
clienteListarNotificacoes()
clienteMarcarNotificacaoLida({ id })
```
Todas com `requireClienteSession` (não `requireSupabaseAuth`).

## Regras críticas
1. **Sessão selada** com `CLIENTE_APP_SESSION_SECRET` ≥ 32 chars; cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `path=/`, `maxAge=8h`.
2. **Rate-limit** no `validarAcessoCliente`: máx. 5 tentativas / documento / 15 min (contadas em `cliente_app_acessos`). Bloqueio 24h após 10 falhas consecutivas.
3. **Sem código, sem OTP, sem mensageria externa** — a "segunda credencial" é a data de nascimento/abertura já armazenada. Se o dado é inválido, retorna a mesma mensagem genérica ("Dados não encontrados").
4. **Escopo total**: server function do cliente lê APENAS dados do próprio `cliente_id` da sessão. Nunca aceita `cliente_id` do body.
5. **Realtime**: subscription em `cliente_app_mensagens` e `cliente_app_notificacoes` no client (Supabase Channels).
6. **Mensagens amigáveis** vêm da coluna `descricao_cliente` da etapa (nunca jargão interno tipo `banco_remessa_1` → mostrar “Enviado ao Banco”).
7. **PWA**: manifest com nome, ícones (192/512), theme_color, standalone; service worker cacheia shell + estratégia network-first para API. **Não registrar Web Push** — não há backend para enviar push.
8. **Notificações são só in-app**: gravadas em `cliente_app_notificacoes` pelo próprio backend nos eventos-chave (etapa mudou, mensagem nova, doc reprovado) e refletidas em realtime no sino.
9. **LGPD**: link em rodapé para baixar dados (JSON) e solicitar exclusão (abre demanda para DPO).
10. **Nunca** expor `homefin_id_*`, `numero_proposta`, dados internos.

## Regras de UI
- Mobile-first (375px). Fontes grandes (16px min). Botões grandes (44px alvo).
- Cores calmas; badge da etapa sempre visível.
- Loading skeletons.
- Toast pt-BR para erros amigáveis (“Falha de conexão. Tente novamente.”).

## Definition of Done
- Login por CPF+data (PF) e CNPJ+data (PJ) funciona sem qualquer provedor externo.
- Etapa muda no interno → cliente vê em <5s (realtime Supabase).
- Upload de doc pelo celular funciona (câmera).
- PWA instalável em Android/iOS, sem push registrado.
- Sessão expira em 8h; refresh silencioso não permitido — cliente relogar.
- Testes: data incorreta → mensagem genérica; 10 falhas → bloqueio 24h; sessão inválida → redireciona; tentar acessar cliente alheio via id no body → 403.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

O App do Cliente é **mobile-first** e usa a mesma paleta, mas com componentes maiores (alvo ≥44px) e tipografia levemente maior.

- **Header do App** (`/cliente/*`): `bg-primary text-primary-foreground` no topo, com nome do cliente, avatar circular `rounded-full`, sino e botão sair. No dark, `--primary` já é a versão mais clara — mantém legibilidade.
- **Card "Etapa Atual"**: `bg-card border border-border rounded-lg p-6`, título `text-primary text-lg font-semibold`, mensagem amigável `text-foreground`, SLA em `text-muted-foreground` (verde/âmbar/vermelho conforme regra da Etapa 07).
- **Timeline de 12 etapas**
  - Concluída: círculo `bg-success text-success-foreground` com `Check`, linha ligadora `bg-success`.
  - Atual: círculo `bg-primary text-primary-foreground` com `animate-pulse` leve, linha ligadora `bg-border`.
  - Próxima/aguardando: círculo `bg-muted text-muted-foreground border border-border`, linha `bg-border`.
  - **Nunca** vermelho em etapa "aguardando" — vermelho no App só quando algo foi recusado.
- **Documento (lista)**
  - `pendente` → chip tone `warning` "Aguardando envio".
  - `enviado` → chip tone `info` "Em análise".
  - `aprovado` → chip tone `success` "Aprovado".
  - `reprovado` → chip tone `danger` "Reenviar" + mensagem do motivo em `text-destructive text-sm`.
  - Botão "Enviar / Substituir": `variant="default"` `size="lg"` largura total no mobile.
- **Chat** (`cliente_app_mensagens`)
  - Bolha do cliente (direita): `bg-accent text-accent-foreground rounded-2xl rounded-br-sm`.
  - Bolha do time (esquerda): `bg-muted text-foreground rounded-2xl rounded-bl-sm`.
  - Data e "lida": `text-muted-foreground text-xs`, alinhamento seguindo a bolha.
- **Sino de notificações**: badge de contagem `bg-destructive text-destructive-foreground` (mesma regra do interno).
- **Toggle de tema**: exposto em `/cliente/perfil` (não no topo do app), com opção "sistema" que respeita `prefers-color-scheme`.
- **PWA (manifest)**: `theme_color = #000F9F`, `background_color = #12131A` (para splash escura padrão no Android). Ícones em `src/assets/app-cliente-icon-192.png` e `-512.png` com fundo azul-marinho, "A" branca.
