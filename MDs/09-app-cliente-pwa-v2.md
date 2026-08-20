# Etapa 09 — App do Cliente 2.0 (PWA autenticado)

> Requer 01, 03, 05. Sessão selada em cookie HttpOnly, **não** Supabase Auth.

## 1. Escopo

**Tabelas**:

- `cliente_portal_acessos(cliente_id UNIQUE, tipo_pessoa, documento_hash, data_referencia, ativo, habilitado_por/em, revogado_por/em)`.
- `cliente_app_acessos(cliente_id, documento, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent, created_at)` — log/rate-limit.
- `cliente_app_processos(id, cliente_id, proposta_id UNIQUE, etapa_atual, proxima_etapa, status_amigavel, descricao_status, banco, produto, ultima_atualizacao_em)`.
- `cliente_app_mensagens(processo_app_id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em)`.
- `cliente_app_notificacoes(cliente_id, tipo, titulo, corpo, link, lida)`.

**Rotas** (`src/routes/cliente.*` — fora do `_authenticated` do Supabase):

- `/cliente` (índice, redireciona `/cliente/visao-geral`).
- `/cliente/visao-geral` — home com etapa atual, timeline 12, próximas ações, últimas mensagens, contato do responsável.
- `/cliente/acompanhar-minha-proposta` — 4 tabs (Meu processo · Documentos · Mensagens · Propostas).
- `/cliente/chat` — chat dedicado (mobile-first, responsive, som + piscar).
- `/cliente/perfil` — dados, LGPD ("Meus dados"/exclusão), preferências (som, tema).
- `/cliente/logout` — limpa cookie e redireciona `/portal`.
- `/cliente-consentimento` — banner LGPD.

**Server fns** em `src/lib/portal/`:

- `session.server.ts`: `sealSession`, `unsealSession`, `requireClienteSession` (middleware).
- `cliente.functions.ts`: `validarAcessoCliente`, `logoutCliente`, `clienteObterVisaoGeral`, `clienteObterProcesso`, `clienteEnviarMensagem`, `clienteMarcarLida`, `clienteUploadDocumento`, `clienteListarNotificacoes`, `clienteSolicitarExclusaoLGPD`.
- `pwa-cliente.ts` — helpers PWA (registro SW, install prompt).

## 2. Fluxo de login (sem OTP)

1. `/portal` — usuário escolhe PF/PJ, digita documento + data.
2. Server fn `validarAcessoCliente({tipo, documento, data})`:
   - Valida rate-limit (5 tentativas / doc / 15min; bloqueio 24h após 10 falhas — em `cliente_app_acessos`).
   - Busca em `cliente_portal_acessos` por `documento_hash` (SHA-256 do doc só-dígitos) + `data_referencia` bate + `ativo=true`.
   - Se OK → cria cookie selado `agz_cliente_app` com `{cliente_id, exp, sig}` usando `CLIENTE_APP_SESSION_SECRET` (≥32 chars).
   - `HttpOnly + Secure + SameSite=Lax + path=/ + maxAge=8h`.
   - Loga sucesso em `cliente_app_acessos`.
3. Redireciona `/cliente/visao-geral`.

Erros sempre genéricos ("Dados não encontrados"). **Nunca revela** se documento existe. **Nunca envia código** — sistema não integra e-mail/SMS/WhatsApp.

## 3. Home `/cliente/visao-geral`

Layout mobile-first:

- Header `bg-primary text-primary-foreground` fixo no topo com nome do cliente + avatar + sino + botão sair.
- Card grande **Etapa Atual** (`bg-card border rounded-lg p-6`): nome amigável, descrição, progresso `X/12`, SLA countdown.
- Timeline visual 12 etapas com scroll horizontal em mobile; concluída `success` ✓, atual `primary` com pulse, próximas `muted`, futuras `muted-foreground border`. **Nunca** vermelho em "aguardando" — vermelho só quando algo foi recusado.
- Cards secundários: Próximas ações (docs a enviar), Últimas mensagens, Meu contato (responsável do time), Últimas notificações.

## 4. Aba Documentos (`/cliente/acompanhar-minha-proposta` → Documentos)

- Lista por status: **Pendente** (chip warning), **Enviado** (chip info), **Aprovado** (chip success), **Reprovado** (chip danger + motivo em `text-destructive text-sm`).
- Botão **"Enviar / Substituir"** por linha, `size="lg"` largura total no mobile — abre `<input type="file" accept="image/*,application/pdf" capture="environment">` para usar câmera do celular.
- Upload via `clienteUploadDocumento(processo_id, tipo, parte, file)` — server valida mimetype + tamanho (≤10MB) + escreve em bucket `documentos-proposta` (privado) + cria `proposta_documentos` com `status='enviado'`.
- Cliente **nunca** vê nome interno de arquivo ou path.

## 5. Aba Mensagens / `/cliente/chat`

- Chat com o time (`cliente_app_mensagens`), realtime via Supabase Channels (`chan cliente_msg:{cliente_id}`).
- Input com anexo (câmera/galeria), indicador digitando, bolha do cliente à direita (`bg-accent`), do time à esquerda (`bg-muted`).
- Som + piscar da aba quando chega mensagem e o cliente está em outra tela (`useIncomingChatSound` + `useChatFlash`).
- **Numero da proposta preenchido automaticamente** em templates do operador (`{numero_proposta}` substituído server-side).

## 6. Notificações

- `cliente_app_notificacoes` alimentada por triggers (etapa mudou, mensagem nova, doc reprovado, contrato emitido).
- Realtime via canal `cliente_notif:{cliente_id}` — sino atualiza em <5s.
- **Sem push, sem SMS, sem e-mail** — só in-app.
- Preferência de som em `/cliente/perfil` (toggle).

## 7. LGPD ("Meus dados")

`/cliente/perfil` tem seção "Direitos LGPD":

- **Baixar meus dados** — server fn gera JSON com `clientes` + `documentos` + `mensagens` + `historico_esteira` do próprio cliente, ZIP com PDFs adicionais.
- **Solicitar exclusão** — abre demanda automática para DPO (papel `admin` + gestor) via `criarDemanda(tipo='lgpd_exclusao', cliente_id=...)`.
- Consentimento em `cliente-consentimento` (banner primeiro acesso).

## 8. PWA

- Manifest `public/manifest-cliente.webmanifest`:
  - `name`: "Portal do Cliente Agilliza"
  - `short_name`: "Agilliza"
  - `theme_color`: `#000F9F`
  - `background_color`: `#12131A` (splash escura)
  - `display`: `standalone`
  - `start_url`: `/cliente/visao-geral`
  - `scope`: `/cliente/`
  - Ícones 192/512 maskable + any + apple-touch-icon em `public/icons/cliente/`.
- Service worker `public/sw-cliente.js` — app-shell offline (network-first para API, cache-first para assets estáticos). **Não registra** push subscriptions.
- Registro SW somente em hosts publicados (nunca em previews `id-preview--*`, `preview--*`, `*.lovableproject.com`, `?sw=off`).
- Install prompt (`src/components/pwa/install-prompt.tsx`) — banner discreto depois do primeiro login, dispensável, não repete.

## 9. Segurança avançada (2.0)

1. **Sessão selada** — nunca aceitar `cliente_id` do body; servidor sempre lê da sessão.
2. **Rate-limit escalonado** — 5/15min soft, 10 fails → 24h hard.
3. **Escopo total** — RLS + server fn filtram por `cliente.id = session.cliente_id` sempre.
4. **Sem OTP externo** — 2º fator é a data no cadastro. Se dado inválido → mensagem genérica.
5. **Cookie**: `HttpOnly + Secure + SameSite=Lax`; testado em Chrome/Safari/Firefox mobile.
6. **CSRF**: mutations exigem `X-CSRF-Token` (gerado no login, guardado em outro cookie legível pelo client).
7. **Sanitização** de input em chat (server-side, DOMPurify equivalente).
8. **Audit** em `admin_audit_logs` para: login OK/fail, revogação, download de dados LGPD, solicitação de exclusão.
9. **Nunca expor** `homefin_id_*`, `numero_proposta interno`, `banco_credenciais`, dados de outros clientes.

## 10. Regras de UI

- Mobile-first (375px). Fontes ≥16px. Alvos ≥44px.
- Skeletons no shape final; nunca spinner.
- Toasts pt-BR amigáveis ("Falha de conexão. Tente novamente.").
- Modo claro/escuro (toggle em `/cliente/perfil` com "sistema" respeitando `prefers-color-scheme`).

## 11. Definition of Done

- Login CPF+data (PF) e CNPJ+data (PJ) sem provedor externo.
- Etapa muda no interno → App reflete em <5s (realtime).
- Upload doc via câmera mobile funciona.
- PWA instalável Android + iOS, ícones nítidos, splash com marca.
- Sessão 8h expira → redireciona `/portal`.
- Documento inexistente → mensagem genérica; 10 fails → bloqueio 24h.
- Modificar body de server fn com `cliente_id` alheio → 403 (session prevalece).
- LGPD "Baixar meus dados" gera ZIP em <10s; "Solicitar exclusão" abre demanda para DPO.
- Chat piscando ao receber msg com aba em background.
- Zero referência interna (HomeFin, banco_credenciais) exposta ao cliente.
