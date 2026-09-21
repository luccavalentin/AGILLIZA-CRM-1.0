# AGILLIZA CRM 1.0

Plataforma do correspondente bancário: simulações, propostas, documentos,
contratos e comissões de crédito imobiliário e home equity.

## Tecnologia

- **Linguagem**: TypeScript no front e no servidor
- **Aplicação**: React 19 com TanStack Start, Router e Query
- **Interface**: Tailwind CSS 4 e componentes shadcn/ui
- **Servidor**: server functions do TanStack Start, publicadas em Cloudflare Workers
- **Banco de dados**: Supabase (PostgreSQL) com RLS e migrações versionadas
- **Testes**: Vitest

## Desenvolvimento

Requer Node.js e npm — [instale com nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <url-deste-repositorio>
cd <pasta-do-repositorio>
npm i
npm run dev
```

## Publicação

O deploy sai do branch `main`: o push publica a versão. Antes de publicar, rode:

```sh
node node_modules/typescript/bin/tsc --noEmit -p .
npx vitest run
npm run lint
npm run build
```
