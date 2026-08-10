# Guia de Deploy em Produção

Este guia explica, passo a passo, como colocar o sistema em produção. Ele cobre
os conceitos essenciais, as variáveis de ambiente necessárias e três caminhos de
publicação: **Lovable (recomendado)**, **Vercel** e **VPS Hostinger**.

---

## 1. Antes de começar — entenda a arquitetura

O sistema é uma aplicação **TanStack Start com renderização no servidor (SSR)**.
Isso é importante:

- **Não é um site estático.** Ele precisa rodar em um ambiente que execute
  código no servidor (Node.js, Cloudflare Workers, Vercel Functions, etc.).
- O build usa o **Nitro**, que por padrão gera saída para **Cloudflare Workers**
  (o ambiente usado pela hospedagem da Lovable). Para publicar em outro lugar
  (Vercel ou VPS), é preciso apontar o Nitro para o alvo correto.
- O banco de dados, autenticação e armazenamento de arquivos ficam no
  **Supabase** (já provisionado). O deploy do front/SSR **não** move o banco —
  ele continua no mesmo projeto Supabase.

### Resumo dos presets de build

| Ambiente                            | Preset do Nitro |
| ----------------------------------- | --------------- |
| Lovable / Cloudflare (padrão atual) | `cloudflare`    |
| Vercel                              | `vercel`        |
| VPS Hostinger (Node)                | `node-server`   |

---

## 2. Variáveis de ambiente

As variáveis abaixo precisam existir no ambiente de produção (na Vercel:
**Settings → Environment Variables**, ambiente **Production** — e **Preview**
se quiser testar deploys de branch).

### Públicas (client) — prefixo `VITE_`

Vão para o bundle do navegador. São públicas por natureza.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Secretas (servidor) — **nunca** com prefixo `VITE_`

Só ficam no servidor. Nunca exponha no front nem versione no repositório.

- `SUPABASE_URL` — mesma URL do projeto Supabase (sem prefixo, uso server-side).
- `SUPABASE_ANON_KEY` — chave anônima (uso server-side).
- `SUPABASE_PUBLISHABLE_KEY` — chave publicável (uso server-side).
- `SUPABASE_SERVICE_ROLE_KEY` — service role (admin; **bypassa RLS**).
- `ADMIN_SERVICE_ROLE_KEY` — service role usado pelo cliente admin.
- `CLIENTE_APP_SESSION_SECRET` — segredo que sela a sessão do app do cliente.
- `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY` — integração bancária.
- `GEMINI_API_KEY` — recursos de IA.
- `CRON_SECRET` — protege o disparo do job de sincronização.

> Copie os valores exatos do painel de segredos do projeto atual (mesmos que
> já rodam hoje). Não invente valores novos, senão a comunicação com o banco e
> a API bancária quebra.

> **Regra de ouro:** segredos são lidos apenas dentro de server functions
> (`createServerFn`) / server routes, via `process.env.*`. Nunca em código de
> cliente.

---

## 3. Checklist pré-produção

Antes de publicar em qualquer ambiente:

- [ ] Rodar o build localmente sem erros (`npm run build`).
- [ ] Conferir que todas as variáveis de ambiente acima estão configuradas.
- [ ] No Supabase, revisar **RLS** ativa em todas as tabelas.
- [ ] No Supabase → Authentication → URL Configuration, incluir a URL de
      produção em **Site URL** e **Redirect URLs**.
- [ ] Testar login interno, portal do parceiro e app do cliente.
- [ ] Verificar que nenhuma tela/PDF expõe nomes internos de infraestrutura.
- [ ] Confirmar que os buckets de Storage têm as políticas corretas.

---

## 🟣 4. Opção A — Publicar na Lovable (recomendado)

O caminho mais simples: a hospedagem já está configurada para o preset
`cloudflare` (o atual), então não é preciso alterar nada no build.

1. No editor da Lovable, clique em **Publish** (canto superior direito).
2. Confira o título/descrição do site.
3. Clique em **Update** para publicar. O sistema fica disponível em uma URL
   `*.lovable.app`.
4. **Alterações de front-end** exigem clicar em _Update_ para irem ao ar.
   **Alterações de back-end** (server functions, migrações) já sobem
   automaticamente.

### Domínio próprio

Após a primeira publicação, vá em **Project Settings → Domains** para conectar
um domínio personalizado.

---

## 🟪 5. Opção B — Publicar na Vercel

1. **Conectar ao GitHub**
   No editor Lovable: menu **(+) → GitHub → Connect project** e crie o
   repositório. A partir daí o código sincroniza automaticamente.

2. **Preset do Nitro — nada a fazer**
   O build detecta a Vercel automaticamente (a Vercel define `VERCEL=1`) e o
   Nitro seleciona o alvo `vercel` sozinho. **Não é preciso editar
   `vite.config.ts`.** Se quiser forçar explicitamente, defina a variável de
   ambiente `NITRO_PRESET=vercel` na Vercel.

3. **Importar na Vercel** (tela que você já está vendo)
   - **Framework Preset:** TanStack Start (já detectado ✅).
   - **Root Directory:** `./` ✅.
   - **Build / Output / Install Command:** deixe os toggles **desligados**
     (usar os padrões). **Não** force o Output Directory para `dist` — no
     preset TanStack Start a saída SSR é montada pelo Nitro (`.vercel/output`),
     não é uma pasta `dist` estática. Sobrescrever quebra o deploy.

4. **Configurar variáveis de ambiente**
   Em **Environment Variables**, adicione **todas** as variáveis da seção 2
   (públicas e secretas). Use **Import .env** para colar de uma vez, ou
   **Add More** para uma a uma. Ambiente: **Production** (e Preview se usar).

5. **Deploy**
   Clique em **Deploy**. A Vercel roda `npm run build`. Cada push no
   repositório dispara um novo deploy automático.

6. **Pós-deploy — ligar a comunicação**
   - **Supabase Auth:** em **Authentication → URL Configuration**, adicione a
     URL da Vercel em **Site URL** e **Redirect URLs** (senão o login não
     redireciona).
   - **Job de sincronização (`/api/public/sync-propostas`):** se você usa
     `pg_cron`/agendador chamando a URL do app, atualize-o para a nova URL da
     Vercel, mantendo o header `apikey` com a anon key. A API bancária é por
     polling, então esse job é o que faz as propostas avançarem sozinhas.
   - **Realtime e server functions** passam a funcionar direto pela URL da
     Vercel assim que as variáveis acima estiverem preenchidas.

---

## 🟢 6. Opção C — Publicar em VPS Hostinger (Node)

Para rodar em uma VPS Ubuntu com Node + Nginx + PM2.

### 6.1 Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
# Gerenciador de processos
sudo npm install -g pm2
```

### 6.2 Ajustar o preset do Nitro para Node

Em `vite.config.ts`, informe o alvo `node-server` para o Nitro. Isso faz o
build gerar um servidor Node em `.output/server/index.mjs`.

### 6.3 Clonar, instalar e buildar

```bash
git clone <URL_DO_SEU_REPO> app
cd app
npm install
# criar arquivo de variáveis de ambiente do servidor (ver seção 2)
npm run build
```

### 6.4 Rodar com PM2

```bash
# porta padrão do servidor gerado costuma ser 3000
pm2 start .output/server/index.mjs --name sistema
pm2 save
pm2 startup   # habilita o boot automático
```

### 6.5 Nginx como proxy reverso

Crie `/etc/nginx/sites-available/sistema`:

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

Ative e recarregue:

```bash
sudo ln -s /etc/nginx/sites-available/sistema /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6.6 HTTPS com Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

### 6.7 Atualizações futuras

```bash
cd app
git pull
npm install
npm run build
pm2 restart sistema
```

---

## 7. Pós-deploy — validação em produção

1. Acessar a URL de produção e fazer login interno.
2. Rodar uma simulação e verificar retorno da integração bancária.
3. Enviar uma proposta de teste e conferir a sincronização.
4. Abrir o **portal do parceiro** e o **app do cliente** (PWA) e validar login.
5. Conferir o recebimento de notificações em tempo real.
6. Testar responsividade em celular (375px) e desktop.
7. Verificar logs em busca de erros de variáveis de ambiente ausentes.

---

## 8. Problemas comuns

| Sintoma                            | Causa provável                               | Solução                                        |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| 404 ao dar F5 numa rota            | preset de build errado / SSR não configurado | Confirmar o preset do Nitro do ambiente        |
| "No authorization header provided" | segredo ou middleware de auth ausente        | Conferir variáveis e a sessão Supabase         |
| `process.env.X is undefined`       | segredo não configurado no ambiente          | Adicionar a variável no painel do provedor     |
| Login não redireciona              | URL de produção fora das Redirect URLs       | Ajustar em Supabase → Auth → URL Configuration |
| Tela em branco após deploy         | build falhou / variáveis públicas ausentes   | Revisar log de build e `VITE_*`                |

---

## 9. Recomendação final

Para o menor esforço e maior confiabilidade, **publique pela Lovable** — o
ambiente já está pronto para o preset atual. Use **Vercel** se quiser CI/CD via
GitHub com zero infraestrutura, e a **VPS Hostinger** apenas se precisar de
controle total do servidor.
