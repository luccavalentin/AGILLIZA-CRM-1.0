# Guia de Deploy em Produção 2.0

> Versão atualizada. Substitui `13-deploy-producao.md`.

## 1. Arquitetura

Aplicação **TanStack Start v1 com SSR**. 

- **Não é site estático.** Precisa de ambiente que execute código no servidor.
- Build usa **Nitro**; padrão hoje: **Cloudflare Workers**. Vercel e VPS Node também suportados.
- Banco/Auth/Storage/Realtime no **Supabase**.

### Presets de build

| Ambiente             | Preset Nitro                             |
| -------------------- | ---------------------------------------- |
| Cloudflare           | `cloudflare`                             |
| Vercel               | `vercel` (auto-detectado por `VERCEL=1`) |
| VPS Node             | `node-server`                            |

## 2. Variáveis de ambiente

### Públicas (client) — prefixo `VITE_`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Secretas (servidor) — nunca com prefixo `VITE_`

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`
- `GEMINI_API_KEY`
- `CRON_SECRET`

## 3. Checklist pré-produção

- [ ] `bun run build` local sem erro.
- [ ] Todas as variáveis configuradas no ambiente alvo.
- [ ] RLS ativa em todas as tabelas.
- [ ] Verificar que PDF/UI não expõem nomes de ferramentas de infraestrutura.

## 4. Opção A — Cloudflare (padrão)

1. **Publish** no painel de controle.
2. Configurar título/descrição.
3. Update para publicar.
4. **Alterações front-end** exigem Update; **back-end** sobe automático.

## 5. Opção B — Vercel

1. Conectar GitHub via Painel → (+) → GitHub → Connect.
2. Preset Nitro autodetectado.
3. Deploy — cada push gera novo deploy.

## 6. Opção C — VPS Hostinger (Node)

### Preparar

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### Deploy

```bash
git clone <URL> app && cd app
npm install
npm run build
pm2 start .output/server/index.mjs --name agilliza
pm2 save
pm2 startup
```

## 7. Recomendação final

- **Menor esforço + confiabilidade**: publicar pela **infraestrutura nativa** (Cloudflare Workers já configurado).