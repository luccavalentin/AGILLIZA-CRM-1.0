# Guia de Deploy em Produção

Este guia explica, passo a passo, como colocar o sistema em produção. Ele cobre
os conceitos essenciais, as variáveis de ambiente necessárias e três caminhos de
publicação: **Plataforma Nativa (recomendado)**, **Vercel** e **VPS Hostinger**.

---

## 1. Antes de começar — entenda a arquitetura

O sistema é uma aplicação **TanStack Start com renderização no servidor (SSR)**.
Isso é importante:

- **Não é um site estático.** Ele precisa rodar em um ambiente que execute
  código no servidor (Node.js, Cloudflare Workers, Vercel Functions, etc.).
- O build usa o **Nitro**, que por padrão gera saída para **Cloudflare Workers**. 
  Para publicar em outro lugar (Vercel ou VPS), é preciso apontar o Nitro para o alvo correto.
- O banco de dados, autenticação e armazenamento de arquivos ficam no
  **Supabase** (já provisionado). O deploy do front/SSR **não** move o banco —
  ele continua no mesmo projeto Supabase.

### Resumo dos presets de build

| Ambiente                            | Preset do Nitro |
| ----------------------------------- | --------------- |
| Cloudflare (padrão atual)           | `cloudflare`    |
| Vercel                              | `vercel`        |
| VPS Hostinger (Node)                | `node-server`   |

---

## 2. Variáveis de ambiente

As variáveis abaixo precisam existir no ambiente de produção.

### Públicas (client) — prefixo `VITE_`

Vão para o bundle do navegador. São públicas por natureza.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Secretas (servidor) — **nunca** com prefixo `VITE_`

Só ficam no servidor. Nunca exponha no front nem versione no repositório.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOMEFIN_BASE_URL`, `HOMEFIN_SECRET_ID`, `HOMEFIN_SECRET_KEY`
- `GEMINI_API_KEY`
- `CRON_SECRET`

---

## 3. Checklist pré-produção

Antes de publicar em qualquer ambiente:

- [ ] Rodar o build localmente sem erros (`npm run build`).
- [ ] Conferir que todas as variáveis de ambiente acima estão configuradas.
- [ ] No Supabase, revisar **RLS** ativa em todas as tabelas.
- [ ] Verificar que nenhuma tela/PDF expõe nomes internos de infraestrutura.

---

## 🟣 4. Opção A — Publicar via Painel Nativa (recomendado)

O caminho mais simples: a hospedagem já está configurada para o preset
`cloudflare` (o atual), então não é preciso alterar nada no build.

1. No painel de controle, clique em **Publish** (canto superior direito).
2. Confira o título/descrição do site.
3. Clique em **Update** para publicar.
4. **Alterações de front-end** exigem clicar em _Update_ para irem ao ar.
   **Alterações de back-end** já sobem automaticamente.

---

## 🟪 5. Opção B — Publicar na Vercel

1. **Conectar ao GitHub**
   No painel de controle: menu **(+) → GitHub → Connect project** e crie o
   repositório. A partir daí o código sincroniza automaticamente.

2. **Preset do Nitro**
   O build detecta a Vercel automaticamente e o Nitro seleciona o alvo `vercel` sozinho.

3. **Deploy**
   Clique em **Deploy**. Cada push no repositório dispara um novo deploy automático.

---

## 🟢 6. Opção C — Publicar em VPS Hostinger (Node)

Para rodar em uma VPS Ubuntu com Node + Nginx + PM2.

### 6.1 Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### 6.2 Ajustar o preset do Nitro para Node

Em `vite.config.ts`, informe o alvo `node-server` para o Nitro.

### 6.3 Rodar com PM2

```bash
pm2 start .output/server/index.mjs --name sistema
pm2 save
pm2 startup
```

---

## 7. Recomendação final

Para o menor esforço e maior confiabilidade, **publique pela infraestrutura nativa** — o
ambiente já está pronto para o preset atual.