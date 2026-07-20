# Guia de Deploy em Produção 2.0

> Versão atualizada. Substitui `13-deploy-producao.md`.

## 1. Arquitetura

Aplicação **TanStack Start v1 com SSR**. Isso é importante:
- **Não é site estático.** Precisa de ambiente que execute código no servidor.
- Build usa **Nitro**; padrão hoje: **Cloudflare Workers**. Vercel e VPS Node também suportados.
- Banco/Auth/Storage/Realtime no **Supabase** (permanece igual em qualquer deploy).

### Presets de build

| Ambiente | Preset Nitro |
|---|---|
| Cloudflare / Lovable | `cloudflare` |
| Vercel | `vercel` (auto-detectado por `VERCEL=1`) |
| VPS Node | `node-server` |

## 2. Variáveis de ambiente

### Públicas (client) — prefixo `VITE_`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Secretas (servidor) — nunca com prefixo `VITE_`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`
- `ADMIN_SERVICE_ROLE_KEY` — cliente admin server-only.
- `CLIENTE_APP_SESSION_SECRET` — sela sessão do App Cliente (≥32 chars).
- `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY` — Integração Bancária.
- `GEMINI_API_KEY` **ou** `OPENAI_API_KEY` — Scan IA (ao menos uma configurada).
- `CRON_SECRET` — protege `/api/public/sync-propostas`.
- `BACKUP_ENCRYPTION_KEY` (2.0) — AES-GCM do backup.

**Regra de ouro**: secrets lidos apenas dentro de `.handler()` via `process.env.*`. Nunca em client.

> `/api/public/homefin/callback` **não existe** (integração é polling). Não configure `HOMEFIN_WEBHOOK_SECRET`.

## 3. Checklist pré-produção

- [ ] `bun run build` local sem erro.
- [ ] `tsgo` sem erro; `supabase--linter` sem warning novo.
- [ ] Todas as variáveis configuradas no ambiente alvo.
- [ ] RLS ativa em todas as tabelas.
- [ ] Supabase → Authentication → URL Configuration: URL de produção em Site URL e Redirect URLs.
- [ ] Testar login em `/auth`, `/portal`, `/parceiro`.
- [ ] Verificar que PDF/UI não expõem "HomeFin"/"Lovable".
- [ ] Buckets com policies corretas: `cliente-documentos`, `documentos-proposta`, `financeiro-comprovantes`, `simulacao-pdfs`, `rh-documentos`.
- [ ] Cron `/api/public/sync-propostas` agendado (pg_cron ou serviço externo) com `CRON_SECRET`.
- [ ] Job diário de refresh de domínios do provedor bancário agendado.
- [ ] Retenção de backup de 90d configurada.

## 4. Opção A — Cloudflare / Lovable (padrão)

1. **Publish** no editor Lovable.
2. Configurar título/descrição.
3. Update para publicar em `*.lovable.app`.
4. **Alterações front-end** exigem Update; **back-end** (server fns, migrações) sobe automático.
5. Domínio próprio em Project Settings → Domains.

## 5. Opção B — Vercel

1. Conectar GitHub via Lovable → (+) → GitHub → Connect.
2. Preset Nitro autodetectado (Vercel define `VERCEL=1`).
3. Import na Vercel:
   - Framework Preset: **TanStack Start** ✔️.
   - Root Directory: `./`.
   - Build/Output/Install: deixar padrões (**não** forçar `dist`).
4. Environment Variables: importar `.env` de uma vez ou adicionar uma a uma para Production (e Preview se usar).
5. Deploy — cada push gera novo deploy.
6. Pós-deploy:
   - Supabase Auth: adicionar URL Vercel em Site URL + Redirect URLs.
   - Cron `/api/public/sync-propostas`: atualizar URL no pg_cron/agendador; header `apikey` com anon key + `CRON_SECRET` no body/header conforme configurado.

## 6. Opção C — VPS Hostinger (Node)

### Preparar
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### Preset
Em `vite.config.ts`, informar `node-server` para o Nitro.

### Deploy
```bash
git clone <URL> app && cd app
npm install
# criar .env do servidor (seção 2)
npm run build
pm2 start .output/server/index.mjs --name agilliza
pm2 save
pm2 startup
```

### Nginx + HTTPS
```nginx
server {
  listen 80;
  server_name seu-dominio.com.br;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

### Atualização
```bash
cd app && git pull && npm install && npm run build && pm2 restart agilliza
```

## 7. Segurança em produção (2.0 — obrigatório)

1. **HTTPS obrigatório** — sem exceção; HSTS ativado.
2. **CORS**: apenas origem do próprio domínio + Supabase URL.
3. **CSP** (Content-Security-Policy) restritiva; permitir `self`, `data:`, Supabase URL, endpoint da IA escolhida.
4. **Cookies**: HttpOnly + Secure + SameSite=Lax; `agz_cliente_app` com TTL 8h.
5. **Rate-limit** no edge (Cloudflare/Vercel/Nginx): `/api/public/*` = 60/min/IP; login = 30/min/IP.
6. **WAF** Cloudflare/Vercel ativado.
7. **Secrets**:
   - Rotação a cada 90d (`SUPABASE_SERVICE_ROLE_KEY`, `HOMEFIN_SECRET_*`, `CLIENTE_APP_SESSION_SECRET`, `BACKUP_ENCRYPTION_KEY`).
   - Rotação da `GEMINI_API_KEY`/`OPENAI_API_KEY` conforme política do provedor.
   - Nunca commitar; nunca logar.
8. **Backup criptografado** (AES-GCM com `BACKUP_ENCRYPTION_KEY`) em bucket separado com retenção 90d.
9. **Logs** — server logs sem PII (mask_pii_jsonb). Retenção 30d. Alertas para 5xx, tentativas de login em massa, export massivo.
10. **Monitoring** — endpoint `/api/public/health` (sem CRON_SECRET) retorna `200 ok`; monitor externo (UptimeRobot etc.) ping a cada 5min.
11. **Detecção de anomalia** — cron horário faz varredura em `admin_audit_logs` e notifica correspondente se padrão suspeito.

## 8. Pós-deploy — validação

1. Acessar URL, login interno.
2. Rodar simulação real na sandbox HomeFin.
3. Enviar proposta e conferir polling atualiza status.
4. Portal Cliente + Portal Parceiro: login e navegação.
5. Notificações realtime.
6. Responsividade 375/768/1280.
7. Logs sem erro de env ausente.
8. Cron rodando (checar `report_audit_logs`/`backup_jobs`).
9. Health-check verde para todas integrações (`/admin/integracoes`).

## 9. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| 404 ao dar F5 | preset errado | Confirmar preset Nitro |
| "No authorization header" | middleware ausente | Verificar `src/start.ts` (bearer) + sessão |
| `process.env.X undefined` | secret não configurado | Adicionar no painel |
| Login não redireciona | URL fora do Redirect URLs | Ajustar Supabase Auth |
| Tela branca | build falhou / `VITE_*` faltando | Revisar log + env vars |
| Proposta não atualiza | cron `/api/public/sync-propostas` parado | Verificar agendador + `CRON_SECRET` |
| Chat sem realtime | WebSocket bloqueado | Verificar CSP/WAF/proxy |

## 10. Recomendação final

- **Menor esforço + confiabilidade**: publicar pela **Lovable** (Cloudflare Workers já configurado).
- **CI/CD via GitHub sem infra**: **Vercel**.
- **Controle total do servidor**: **VPS Hostinger** (Node + Nginx + PM2 + Certbot).
