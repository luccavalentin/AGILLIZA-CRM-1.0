# 00b — Tons, Cores e Design Tokens (Agilliza)

> Colar junto do `00-convencoes-globais.md` em **toda** etapa que produza tela. Este documento é a **única fonte de verdade visual** do sistema. Se algum outro prompt disser uma cor diferente, este vence.

---

## 1. Como pensar cor neste sistema (leitura obrigatória)

1. **Um único idioma de cor.** Toda cor em componente vem de um **token semântico** definido em `src/styles.css` (`bg-primary`, `text-muted-foreground`, `border-input` etc.). É proibido escrever `text-white`, `bg-black`, `bg-[#000f9f]`, `text-[#f5333f]` dentro de `.tsx`. Se precisar de uma cor nova, primeiro se cria o token, depois se usa a classe.
2. **Duas versões da mesma paleta: claro e escuro.** O sistema tem tema **claro (padrão)** e **escuro** completos. Ambos preservam a identidade Agilliza (azul-marinho como cor de comando, vermelho **só** para alerta). O usuário troca no topbar; o toggle grava a preferência em `localStorage` (`agilliza-theme`) e no `profiles.tema_preferido`. Nunca inventar um "terceiro modo".
3. **Marca acima de tudo.** Azul profundo `#000F9F` (PANTONE Blue 072 C) é a cor de ação — botão principal, link, foco, ícone ativo, série 1 de gráfico. Vermelho `#F5333F` (PANTONE Red 032 C) é **exclusivamente** de alerta/destrutivo/SLA estourado. Nunca de botão "Salvar", nunca de fundo decorativo, nunca de KPI positivo.
4. **Sem gradiente decorativo.** As duas únicas exceções permitidas:
   - Sidebar em modo escuro (`#000A6E → #00052E`, do topo para o rodapé).
   - Barra fina de progresso do SLA (`success → warning → alert`).
   Nada de `bg-gradient-to-r` em botão, hero, KPI ou card.
5. **Contraste AA sempre.** Todo par texto/fundo passa em WCAG AA (4.5:1 em corpo, 3:1 em títulos ≥18pt/bold). O verificador do design de tokens roda no CI (`bun run check:contrast`).

---

## 2. Paleta oficial (Manual da Marca Agilliza)

Cores-base fixas, iguais em light e dark. O que muda entre os modos é **onde** cada cor aparece (superfície vs. texto vs. borda).

| Nome           | Hex        | OKLCH aproximado           | Papel                                                        |
| -------------- | ---------- | -------------------------- | ------------------------------------------------------------ |
| Azul Profundo  | `#000F9F`  | `oklch(0.30 0.24 265)`     | Marca / ação primária / foco / série 1                       |
| Azul Escuro    | `#000A70`  | `oklch(0.24 0.22 265)`     | Hover/pressed da primária + topo da sidebar (dark)           |
| Azul Noite     | `#00052E`  | `oklch(0.14 0.11 265)`     | Fim do gradiente da sidebar (dark) / superfície escura mais funda |
| Azul Névoa     | `#EEF0FF`  | `oklch(0.96 0.03 265)`     | Fundo suave (chip info, hover leve, seleção)                 |
| Vermelho Alerta| `#F5333F`  | `oklch(0.62 0.24 25)`      | Erro / destrutivo / SLA estourado / badge crítico            |
| Vermelho Escuro| `#B21F29`  | `oklch(0.47 0.22 25)`      | Hover do destrutivo                                          |
| Verde Sucesso  | `#10A37F`  | `oklch(0.66 0.14 165)`     | Aprovado / pago / ativo / contrato emitido                   |
| Âmbar Atenção  | `#EAB308`  | `oklch(0.78 0.16 85)`      | Pendente / SLA em risco / vencimento próximo                 |
| Cinza Grafite  | `#0B0B0F`  | `oklch(0.14 0.01 260)`     | Texto principal em modo claro                                |
| Cinza Névoa    | `#F7F8FA`  | `oklch(0.98 0.005 260)`    | Fundo secundário claro (zebra, skeleton)                     |
| Cinza Médio    | `#6B7280`  | `oklch(0.55 0.02 260)`     | Texto secundário / placeholder                               |
| Cinza Linha    | `#E5E7EB`  | `oklch(0.91 0.01 260)`     | Bordas em modo claro                                         |
| Papel          | `#FFFFFF`  | `oklch(1 0 0)`             | Superfície de card em modo claro                             |
| Grafite Sup.   | `#12131A`  | `oklch(0.18 0.01 260)`     | Fundo geral em modo escuro                                   |
| Grafite Card   | `#191A22`  | `oklch(0.22 0.01 260)`     | Superfície de card em modo escuro                            |
| Grafite Linha  | `#2A2C38`  | `oklch(0.30 0.01 260)`     | Bordas em modo escuro                                        |
| Nuvem          | `#E6E8F0`  | `oklch(0.92 0.02 265)`     | Texto principal em modo escuro                               |

> Todo hex acima vai também para `--brand-*` no root do `styles.css`, para uso em PDFs, e-mails renderizados server-side (Etapa 05) e Recharts. Nada de reabrir Adobe Illustrator para tirar cor nova.

---

## 3. Tokens semânticos — MODO CLARO (padrão)

Definir em `src/styles.css` dentro de `@theme inline` (mapear para as CSS vars declaradas em `:root`):

| Token (classe Tailwind)       | Valor (light)              | Onde aparece                                                    |
| ----------------------------- | -------------------------- | --------------------------------------------------------------- |
| `background` / `bg-background`| `#FFFFFF`                  | Fundo geral da aplicação                                        |
| `foreground` / `text-foreground` | `#0B0B0F`               | Texto principal                                                 |
| `card` / `bg-card`            | `#FFFFFF`                  | Fundo do card                                                   |
| `card-foreground`             | `#0B0B0F`                  | Texto dentro do card                                            |
| `popover` / `bg-popover`      | `#FFFFFF`                  | Popover, dropdown, tooltip                                      |
| `popover-foreground`          | `#0B0B0F`                  | Texto do popover                                                |
| `primary` / `bg-primary`      | `#000F9F`                  | Botão primário, link, item ativo, foco                          |
| `primary-foreground`          | `#FFFFFF`                  | Texto sobre `primary`                                           |
| `secondary` / `bg-secondary`  | `#F1F2F7`                  | Botão secundário, chip neutro                                   |
| `secondary-foreground`        | `#0B0B0F`                  | Texto do secundário                                             |
| `muted` / `bg-muted`          | `#F7F8FA`                  | Fundo de zebra, skeleton, painel lateral leve                   |
| `muted-foreground`            | `#6B7280`                  | Label auxiliar, placeholder, texto de apoio                     |
| `accent` / `bg-accent`        | `#EEF0FF`                  | Hover suave, chip informativo, badge "novo"                     |
| `accent-foreground`           | `#000F9F`                  | Texto sobre `accent`                                            |
| `destructive` / `bg-destructive` | `#F5333F`               | Botão destrutivo (excluir, cancelar, estornar, revogar acesso)  |
| `destructive-foreground`      | `#FFFFFF`                  | Texto sobre `destructive`                                       |
| `success` / `bg-success`      | `#10A37F`                  | Badge/pill/KPI de sucesso                                       |
| `success-foreground`          | `#FFFFFF`                  | Texto sobre `success`                                           |
| `warning` / `bg-warning`      | `#EAB308`                  | Badge/pill/KPI de atenção                                       |
| `warning-foreground`          | `#1A1400`                  | Texto sobre `warning` (marrom escuro para contraste)            |
| `border`                      | `#E5E7EB`                  | Borda de card, divisor, tabela                                  |
| `input`                       | `#E5E7EB`                  | Borda de input em repouso                                       |
| `ring`                        | `#000F9F`                  | Anel de foco (2px, com offset 2px)                              |
| `sidebar`                     | `#FFFFFF`                  | Fundo da sidebar em modo claro                                  |
| `sidebar-foreground`          | `#0B0B0F`                  | Texto/ícone da sidebar em modo claro                            |
| `sidebar-accent`              | `#EEF0FF`                  | Item ativo da sidebar (light)                                   |
| `sidebar-accent-foreground`   | `#000F9F`                  | Texto do item ativo (light)                                     |
| `sidebar-border`              | `#E5E7EB`                  | Divisor de grupos na sidebar                                    |

Série de gráficos (Recharts) — mesma ordem em light e dark:

| Var          | Hex        | Uso                                     |
| ------------ | ---------- | --------------------------------------- |
| `--chart-1`  | `#000F9F`  | Série principal (comercial, receita)    |
| `--chart-2`  | `#4B56D1`  | Série de apoio (comparativo, período)   |
| `--chart-3`  | `#10A37F`  | Positivo (aprovado, pago)               |
| `--chart-4`  | `#EAB308`  | Atenção (pendente, SLA em risco)        |
| `--chart-5`  | `#F5333F`  | Negativo (recusa, cancelamento)         |

Séries extras (>5) repetem `chart-1..5` com 70% de opacidade. Nunca inventar cor nova no componente.

---

## 4. Tokens semânticos — MODO ESCURO (classe `.dark` no `<html>`)

O modo escuro **não é simplesmente "inverter"**. É uma paleta redesenhada para manter a mesma identidade de marca em fundo grafite. O usuário troca no topbar; o `<html>` recebe `class="dark"`.

| Token (classe Tailwind)       | Valor (dark)               | Como fica visualmente                                         |
| ----------------------------- | -------------------------- | ------------------------------------------------------------- |
| `background`                  | `#12131A`                  | Fundo geral escuro (grafite)                                  |
| `foreground`                  | `#E6E8F0`                  | Texto principal (branco frio)                                 |
| `card`                        | `#191A22`                  | Cartão levemente elevado (~3% mais claro que o fundo)         |
| `card-foreground`             | `#E6E8F0`                  | Texto do card                                                 |
| `popover`                     | `#1F2130`                  | Popover, dropdown, tooltip                                    |
| `popover-foreground`          | `#E6E8F0`                  | Texto do popover                                              |
| `primary`                     | `#4B56D1`                  | Botão primário **um pouco mais claro** para contrastar no escuro (mantém a família azul Agilliza) |
| `primary-foreground`          | `#FFFFFF`                  | Texto sobre `primary`                                         |
| `secondary`                   | `#242637`                  | Botão secundário / chip neutro no escuro                      |
| `secondary-foreground`        | `#E6E8F0`                  | Texto do secundário                                           |
| `muted`                       | `#1C1E29`                  | Zebra de tabela, skeleton                                     |
| `muted-foreground`            | `#8C90A6`                  | Label auxiliar, placeholder                                   |
| `accent`                      | `#1F2657`                  | Hover suave, chip informativo (azul-marinho profundo)         |
| `accent-foreground`           | `#C7CEFF`                  | Texto sobre `accent` (azul-névoa)                             |
| `destructive`                 | `#F5333F`                  | Vermelho segue o mesmo — alerta não muda                      |
| `destructive-foreground`      | `#FFFFFF`                  | Texto sobre destructive                                       |
| `success`                     | `#22C79A`                  | Um pouco mais claro que no light, para não sumir              |
| `success-foreground`          | `#02241B`                  | Texto sobre success                                           |
| `warning`                     | `#F5C044`                  | Um pouco mais claro                                           |
| `warning-foreground`          | `#1A1400`                  | Texto sobre warning                                           |
| `border`                      | `#2A2C38`                  | Borda de card, divisor                                        |
| `input`                       | `#2A2C38`                  | Borda de input em repouso                                     |
| `ring`                        | `#4B56D1`                  | Anel de foco (2px)                                            |
| `sidebar`                     | `linear-gradient(180deg, #000A70 0%, #00052E 100%)` | Sidebar em azul-marinho profundo, gradiente vertical |
| `sidebar-foreground`          | `#EEF0FF`                  | Texto/ícone da sidebar                                        |
| `sidebar-accent`              | `#001A9E`                  | Item ativo da sidebar (dark)                                  |
| `sidebar-accent-foreground`   | `#FFFFFF`                  | Texto do item ativo                                           |
| `sidebar-border`              | `rgba(255,255,255,0.08)`   | Divisor de grupos na sidebar                                  |

> Regra de "elevação": a cada nível acima do fundo, subir ~3% de luminosidade (`background` → `card` → `popover` → `overlay do dialog`). Nunca deixar dois níveis empilhados na mesma cor — o usuário perde o senso de camada.

---

## 5. Tons de status de negócio (usa `<ToneBadge>` de `src/components/crm/status-badges.tsx`)

Uma **única** tabela cobre todo status do sistema — cliente, simulação, proposta, tarefa, demanda, financeiro, portal. Nunca criar cor de status ad-hoc no componente. Se surgir um status novo, adicionar ao mapa (`CLIENTE_STATUS`, `DOC_STATUS_MAP`, `PORTAL_STATUS`, `PROPOSTA_STATUS`, `SIM_STATUS`) e reutilizar um dos 5 tons abaixo.

| Tone       | Fundo (light) | Texto (light)  | Fundo (dark)         | Texto (dark)   | Quando usar                                                 |
| ---------- | ------------- | -------------- | -------------------- | -------------- | ----------------------------------------------------------- |
| `success`  | `#DCFCE7`     | `#046C4E`      | `rgba(34,199,154,.15)` | `#4ADE9F`   | aprovado, pago, ativo, contrato emitido, doc ok             |
| `warning`  | `#FEF3C7`     | `#7A4E0B`      | `rgba(245,192,68,.18)` | `#FBBF24`   | pendente, aguardando doc, SLA 50–99%, vencimento próximo    |
| `danger`   | `#FEE2E2`     | `#B21F29`      | `rgba(245,51,63,.18)`  | `#FCA5A5`   | recusado, cancelado, atrasado, SLA estourado, bloqueado     |
| `info`     | `#EEF0FF`     | `#000F9F`      | `rgba(75,86,209,.20)`  | `#C7CEFF`   | em análise, em simulação, novo, informativo                 |
| `muted`    | `#F1F2F7`     | `#6B7280`      | `#242637`              | `#8C90A6`   | rascunho, arquivado, desconhecido, sem valor                |

Em kanban (propostas/tarefas/demandas), a **coluna** recebe apenas uma barra fina de 3px no topo, na cor do tone. O fundo do card do kanban continua `card` — nunca pintar o card inteiro na cor do status.

---

## 6. Regras por elemento

- **Botões** (variantes do `Button` shadcn):
  - `default` → `primary`/`primary-foreground` (única ação principal por tela).
  - `secondary` → `secondary`/`secondary-foreground` (ações neutras).
  - `outline` → borda `border`, texto `foreground`, fundo transparente.
  - `ghost` → transparente, hover `accent`.
  - `destructive` → `destructive`/`destructive-foreground` (excluir, cancelar, estornar, revogar acesso).
  - **Regras absolutas**: nunca botão primário vermelho. Nunca "Salvar" destrutivo. Nunca dois botões primários lado a lado — o segundo vira `outline` ou `ghost`.
- **Links de conteúdo**: `text-primary hover:text-primary/80 underline-offset-4`.
- **Foco por teclado**: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` em **todo** interativo. Nunca `outline: none` sem substituto.
- **Cards/superfícies**: `bg-card border border-border rounded-lg`. Sombra só em drawer/dialog/popover (`shadow-lg` no light, `shadow-2xl` no dark). Nunca sombra em card de lista.
- **Inputs**: `border-input bg-background`. Estado de erro: `border-destructive` + mensagem `text-destructive text-sm` abaixo. Placeholder `text-muted-foreground`.
- **KPIs** (`ReportKpiCard`): tone `brand` para métrica principal, `success` para receita/aprovação, `warning` para pendência, `danger` para atraso/inadimplência, `neutral` para volumes brutos.
- **Charts**: sempre `var(--chart-1..5)`; jamais hex direto no `<Bar fill=...>`.
- **Sidebar**: no dark, gradiente `#000A70 → #00052E`; no light, superfície branca com borda direita `border`. Item ativo: `bg-sidebar-accent text-sidebar-accent-foreground`. Item hover: `bg-white/5` (dark) ou `bg-accent` (light).
- **Chat do App Cliente** (Etapa 09): bolha do cliente `bg-accent text-accent-foreground` alinhada à direita; bolha do time `bg-muted text-foreground` alinhada à esquerda. Data e "lida" em `text-muted-foreground text-xs`. Nada de azul cheio no fundo da bolha (contraste ruim em mobile).
- **Timeline de etapas** (App Cliente): concluída = ícone `success`, atual = ícone `primary` com pulse leve, próxima = ícone `muted-foreground`. Nunca vermelho em etapa "aguardando".
- **Skeleton / loading**: `bg-muted animate-pulse rounded-md`.
- **Toast** (sonner): `success` verde, `warning` âmbar, `error` vermelho, `info` azul-névoa. Sempre texto em pt-BR e ≤80 caracteres.

---

## 7. Como o modo escuro é ativado (código, não decoração)

- `src/lib/theme.ts` expõe `getTheme()`, `setTheme(t)`, `subscribe(cb)`. Grava em `localStorage['agilliza-theme']` e aplica `document.documentElement.classList.toggle('dark', t === 'dark')`.
- No topbar existe um toggle (sol/lua) alimentado por `useTheme()`. Também presente em `/conta/perfil` como preferência persistida.
- Ao logar, lê `profiles.tema_preferido` (`light | dark | sistema`); se `sistema`, respeita `prefers-color-scheme`.
- **Nunca** ler `window.matchMedia` em módulo top-level (quebra SSR). Sempre dentro de `useEffect`.

---

## 8. Tipografia

- **Fonte única**: Inter Variable, carregada localmente via `@fontsource-variable/inter` importado em `src/styles.css`. Sem Google Fonts CDN, sem `<link>` remoto.
- Escala: `text-xs` legenda, `text-sm` corpo de tabela, `text-base` corpo, `text-lg` subtítulo, `text-xl`/`text-2xl` título de página, `text-3xl` KPI principal.
- Peso: 400 corpo, 500 label, 600 título/KPI. Nada de 700+ decorativo.
- Números **sempre** `tabular-nums` em KPI, tabela financeira, SLA countdown e comparativos.
- Proibido: serif, display, script, "Poppins", "Roboto", "Montserrat".

---

## 9. Espaçamento, raio, sombra

- `--radius: 0.625rem` (10px). Botão/input/card `rounded-lg` (= radius). Chip/badge `rounded-md`. Avatar `rounded-full`.
- Grid: `gap-4` (16px) padrão; `gap-6` (24px) entre seções; `gap-2` dentro de toolbar.
- Padding de card: `p-4` (compacto) / `p-6` (padrão).
- Densidade de tabela: linha `h-11` desktop, `h-12` mobile (alvo de toque ≥44px).
- Sombras: `shadow-sm` para elevação leve em light; **nenhuma** sombra em card de lista; `shadow-lg` só em dialog/drawer/popover; no dark trocar por `shadow-2xl` com `shadow-black/50`.

---

## 10. Iconografia

- Lucide, `strokeWidth={1.75}`, tamanho `h-4 w-4` inline / `h-5 w-5` em botão / `h-6 w-6` em header.
- Ícone segue a cor do texto (`currentColor`). Nunca pintar ícone com cor arbitrária.
- Nunca usar emoji como ícone funcional.

---

## 11. Snippet canônico de `src/styles.css`

Copiar como base ao gerar o projeto. Não alterar nomes de token — as classes Tailwind derivam deles.

```css
@import "tailwindcss";
@import "@fontsource-variable/inter";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --radius: 0.625rem;

  --background: #ffffff;
  --foreground: #0b0b0f;
  --card: #ffffff;
  --card-foreground: #0b0b0f;
  --popover: #ffffff;
  --popover-foreground: #0b0b0f;
  --primary: #000f9f;
  --primary-foreground: #ffffff;
  --secondary: #f1f2f7;
  --secondary-foreground: #0b0b0f;
  --muted: #f7f8fa;
  --muted-foreground: #6b7280;
  --accent: #eef0ff;
  --accent-foreground: #000f9f;
  --destructive: #f5333f;
  --destructive-foreground: #ffffff;
  --success: #10a37f;
  --success-foreground: #ffffff;
  --warning: #eab308;
  --warning-foreground: #1a1400;
  --border: #e5e7eb;
  --input: #e5e7eb;
  --ring: #000f9f;

  --sidebar: #ffffff;
  --sidebar-foreground: #0b0b0f;
  --sidebar-accent: #eef0ff;
  --sidebar-accent-foreground: #000f9f;
  --sidebar-border: #e5e7eb;

  --chart-1: #000f9f;
  --chart-2: #4b56d1;
  --chart-3: #10a37f;
  --chart-4: #eab308;
  --chart-5: #f5333f;
}

.dark {
  --background: #12131a;
  --foreground: #e6e8f0;
  --card: #191a22;
  --card-foreground: #e6e8f0;
  --popover: #1f2130;
  --popover-foreground: #e6e8f0;
  --primary: #4b56d1;
  --primary-foreground: #ffffff;
  --secondary: #242637;
  --secondary-foreground: #e6e8f0;
  --muted: #1c1e29;
  --muted-foreground: #8c90a6;
  --accent: #1f2657;
  --accent-foreground: #c7ceff;
  --destructive: #f5333f;
  --destructive-foreground: #ffffff;
  --success: #22c79a;
  --success-foreground: #02241b;
  --warning: #f5c044;
  --warning-foreground: #1a1400;
  --border: #2a2c38;
  --input: #2a2c38;
  --ring: #4b56d1;

  --sidebar: linear-gradient(180deg, #000a70 0%, #00052e 100%);
  --sidebar-foreground: #eef0ff;
  --sidebar-accent: #001a9e;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
}

@theme inline {
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
}
```

---

## 12. Definition of Done (visual)

Uma tela só sobe para review se:

1. `rg -n "text-white|bg-black|bg-\[#|text-\[#|from-|to-|via-" src/` retorna **zero** ocorrências novas.
2. Todos os status usam `ToneBadge` (ou os wrappers `StatusBadge` / `PortalBadge` / `DocStatusBadge`).
3. O único botão vermelho da tela é destrutivo; o único botão azul cheio é o primário.
4. Toggle claro/escuro no topbar não quebra contraste em nenhum bloco. Testar com screenshot lado a lado.
5. Foco por teclado visível em todo interativo (tab pela tela inteira).
6. Charts usam `var(--chart-N)`; PDF de relatório usa o mesmo hex do `--chart-*`.
7. Nenhuma fonte além de Inter foi carregada (`rg -n "fonts.googleapis|@import.*http" src/` = 0).
8. Sidebar em dark é gradiente azul-marinho; em light é branca com borda.
9. Nenhum card de lista tem sombra; drawer/dialog tem `shadow-lg` (light) ou `shadow-2xl` (dark).
