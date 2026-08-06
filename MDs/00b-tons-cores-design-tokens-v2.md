# 00b — Tons, Cores e Design Tokens 2.0 (Agilliza)

> Versão 2.0 — fonte única de verdade visual. Substitui `00b-tons-cores-design-tokens.md`. Colar junto de `00-convencoes-globais-v2.md` em toda etapa que produza UI.

## 1. Princípios

1. **Um único idioma de cor.** Toda cor vem de token semântico em `src/styles.css`. Proibido `text-white`, `bg-black`, `bg-[#...]` no `.tsx`.
2. **Duas versões: light (padrão) + dark**, ambas com identidade Agilliza. Toggle no topbar; grava `localStorage['agilliza-theme']` + `profiles.tema_preferido`.
3. **Marca**: azul profundo `#000F9F` (primary). Vermelho `#F5333F` é **exclusivamente** alerta/destrutivo/SLA estourado — nunca botão "Salvar", nunca KPI positivo.
4. **Sem gradiente decorativo.** Exceções permitidas: (a) sidebar dark (`#000A70 → #00052E`), (b) barra fina de progresso de SLA (`success → warning → alert`).
5. **Contraste AA.** 4.5:1 corpo, 3:1 título ≥18pt/bold.

## 2. Paleta oficial (Manual da Marca Agilliza)

| Nome | Hex | Papel |
|---|---|---|
| Azul Profundo | `#000F9F` | Marca / ação primária / foco / série 1 |
| Azul Escuro | `#000A70` | Hover primário + topo sidebar dark |
| Azul Noite | `#00052E` | Fim gradiente sidebar dark |
| Azul Névoa | `#EEF0FF` | Chip info, hover leve, seleção |
| Vermelho Alerta | `#F5333F` | Erro / destrutivo / SLA estourado |
| Vermelho Escuro | `#B21F29` | Hover destructive |
| Verde Sucesso | `#10A37F` | Aprovado / pago / ativo / contrato emitido |
| Âmbar Atenção | `#EAB308` | Pendente / SLA em risco / vencimento próximo |
| Cinza Grafite | `#0B0B0F` | Texto principal light |
| Cinza Névoa | `#F7F8FA` | Fundo secundário light |
| Cinza Médio | `#6B7280` | Texto secundário / placeholder |
| Cinza Linha | `#E5E7EB` | Bordas light |
| Papel | `#FFFFFF` | Card light |
| Grafite Superficie | `#12131A` | Fundo geral dark |
| Grafite Card | `#191A22` | Card dark |
| Grafite Linha | `#2A2C38` | Bordas dark |
| Nuvem | `#E6E8F0` | Texto principal dark |

## 3. Tokens semânticos — LIGHT (padrão)

| Classe | Valor | Uso |
|---|---|---|
| `bg-background` / `text-foreground` | `#FFFFFF` / `#0B0B0F` | Base |
| `bg-card` / `text-card-foreground` | `#FFFFFF` / `#0B0B0F` | Cards |
| `bg-popover` | `#FFFFFF` | Popover, dropdown, tooltip |
| `bg-primary` / `text-primary-foreground` | `#000F9F` / `#FFFFFF` | Ação primária, link, item ativo |
| `bg-secondary` | `#F1F2F7` | Botão neutro |
| `bg-muted` / `text-muted-foreground` | `#F7F8FA` / `#6B7280` | Zebra, skeleton, label auxiliar |
| `bg-accent` / `text-accent-foreground` | `#EEF0FF` / `#000F9F` | Hover suave, chip info |
| `bg-destructive` | `#F5333F` | Excluir, cancelar, estornar |
| `bg-success` | `#10A37F` | Sucesso |
| `bg-warning` / `text-warning-foreground` | `#EAB308` / `#1A1400` | Atenção |
| `border` / `input` | `#E5E7EB` | Bordas |
| `ring` | `#000F9F` | Foco 2px + offset 2px |
| `bg-sidebar` / `text-sidebar-foreground` | `#FFFFFF` / `#0B0B0F` | Sidebar light |
| `bg-sidebar-accent` | `#EEF0FF` | Item ativo sidebar light |

Série de gráficos (Recharts):

| Var | Hex | Uso |
|---|---|---|
| `--chart-1` | `#000F9F` | Principal |
| `--chart-2` | `#4B56D1` | Apoio / comparativo |
| `--chart-3` | `#10A37F` | Positivo |
| `--chart-4` | `#EAB308` | Atenção |
| `--chart-5` | `#F5333F` | Negativo |

## 4. Tokens semânticos — DARK (`.dark`)

| Classe | Valor |
|---|---|
| `background` | `#12131A` |
| `foreground` | `#E6E8F0` |
| `card` | `#191A22` |
| `popover` | `#1F2130` |
| `primary` | `#4B56D1` (mais claro no dark) |
| `secondary` | `#242637` |
| `muted` / `muted-foreground` | `#1C1E29` / `#8C90A6` |
| `accent` / `accent-foreground` | `#1F2657` / `#C7CEFF` |
| `destructive` | `#F5333F` |
| `success` | `#22C79A` |
| `warning` | `#F5C044` |
| `border` / `input` | `#2A2C38` |
| `ring` | `#4B56D1` |
| `sidebar` | `linear-gradient(180deg, #000A70 0%, #00052E 100%)` |
| `sidebar-foreground` | `#EEF0FF` |
| `sidebar-accent` | `#001A9E` |
| `sidebar-border` | `rgba(255,255,255,0.08)` |

**Elevação**: `background → card → popover → dialog-overlay`, +3% de luminosidade por nível.

## 5. Tons de status de negócio (`<ToneBadge>`)

Uma única tabela cobre TODO status do sistema (cliente, simulação, proposta, tarefa, demanda, financeiro, RH, portal, matrícula):

| Tone | Uso |
|---|---|
| `success` | aprovado, pago, ativo, contrato emitido, doc OK, férias gozadas |
| `warning` | pendente, SLA 50–99%, vencimento próximo, aguardando doc, em experiência |
| `danger` | recusado, cancelado, atrasado, SLA estourado, bloqueado, vencido dobro |
| `info` | em análise, em simulação, novo, informativo |
| `muted` | rascunho, arquivado, sem valor, encerrado |

Kanban: coluna recebe barra de 3px do tone no topo. Card em si continua `bg-card`.

## 6. Regras por elemento (2.0)

- **Botões shadcn**:
  - `default` → `primary` (uma ação principal por tela).
  - `secondary` → neutro.
  - `outline` → borda `border`, transparente.
  - `ghost` → hover `accent`.
  - `destructive` → `destructive` (excluir, cancelar, estornar). Nunca primário vermelho, nunca "Salvar" destrutivo.
- **Links**: `text-primary hover:text-primary/80 underline-offset-4`.
- **Foco**: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` em todo interativo.
- **Cards**: `bg-card border border-border rounded-lg`. Sombra só em drawer/dialog/popover.
- **Inputs**: `border-input bg-background`. Erro: `border-destructive` + mensagem `text-destructive text-sm`.
- **KPIs (`ReportKpiCard`)**: `brand` para métrica-mor; `success` receita/aprovação; `warning` pendência; `danger` atraso; `muted` volume bruto.
- **Charts**: sempre `var(--chart-1..5)`. Séries >5 repetem `chart-1..5` com 70% opacidade.
- **Sidebar dark**: gradiente. Item ativo `bg-sidebar-accent text-white` + barra vertical 3px `bg-primary`. Item hover `bg-white/5`.
- **Timeline de etapas (CRM/App Cliente)**: concluída = `success`; atual = `primary` com `animate-pulse` leve; próxima = `muted-foreground`. Nunca vermelho em etapa "aguardando".
- **Skeleton**: `bg-muted animate-pulse rounded-md`.
- **Toast (sonner)**: success verde, warning âmbar, error vermelho, info azul-névoa. Texto pt-BR ≤80 chars.
- **Chat**:
  - Bolha própria: `bg-accent text-accent-foreground rounded-2xl rounded-br-sm` (direita).
  - Bolha do outro: `bg-muted text-foreground rounded-2xl rounded-bl-sm` (esquerda).
  - Meta (data/lida): `text-muted-foreground text-xs`.
  - Chat minimizado piscando: classe `chat-blink` (definida em `styles.css`).
- **Tags de chat CRM** (`crm_chat_etiquetas`): usar classes `.chat-tag-{cor}` em `styles.css` (7 cores pré-definidas: azul, verde, laranja, roxo, rosa, cinza, vermelho). Nunca inline color.
- **Bancos**: `<BancoChip>` e `<BancoLogo>` de `src/components/bancos/`. Cores por banco em `src/lib/bancos/cores.ts` — usadas apenas para status/detalhes, não para preencher card inteiro.

## 7. Modo escuro — ativação (código)

- `src/lib/theme.ts` expõe `getTheme() | setTheme(t) | subscribe(cb)`. Aplica `document.documentElement.classList.toggle('dark', t === 'dark')`.
- Toggle no topbar via `useTheme()`. Também em `/conta/perfil` e `/cliente/perfil`.
- Preferência inicial vem de `profiles.tema_preferido` (`light | dark | sistema`); `sistema` respeita `prefers-color-scheme`.
- **Nunca** `window.matchMedia` em top-level.

## 8. Tipografia

- **Inter Variable** via `@fontsource-variable/inter`, importada em `src/styles.css`. Sem CDN.
- Escala: `text-xs` legenda · `text-sm` corpo tabela · `text-base` corpo · `text-lg` subtítulo · `text-xl/2xl` título página · `text-3xl` KPI hero.
- Pesos: 400 corpo · 500 label · 600 título/KPI. Nunca ≥700 decorativo.
- **`tabular-nums`** obrigatório em KPI, tabela financeira, SLA countdown, comparativo.

## 9. Densidade e espaçamento

- Padding de card: `p-4` (mobile) / `p-6` (desktop).
- Espaçamento entre seções: 20–24px. Entre cards: 12px.
- Alvos clicáveis mobile: ≥44×44px.
- Raio padrão: `rounded-lg` (12px). Chips/badges `rounded-md` (8px). Avatares `rounded-full`.

## 10. Marca d'água em PDFs (2.0)

Todo PDF exportado do sistema (relatórios, ficha do funcionário, holerite, proposta, simulação, calendário de tarefas) leva:
- Cabeçalho azul `#000F9F` com logo Agilliza (`src/assets/brand/agilliza-*.png`).
- Marca d'água diagonal cinza claro "AGILLIZA — CONFIDENCIAL" em todas as páginas (opacidade ~10%).
- Rodapé: data de emissão + usuário emissor + numeração `pág X/N`.
- Ignora o tema do usuário (sempre light para impressão).

## 11. DoD visual (checklist obrigatório antes de fechar tela)

- [ ] Nenhuma cor crua no `.tsx`.
- [ ] Testado em light e dark.
- [ ] Responsivo 375/768/1280/1440.
- [ ] Contraste AA validado.
- [ ] Foco visível em todos interativos.
- [ ] Números `tabular-nums` onde aplicável.
- [ ] Skeleton no shape final, não spinner.
- [ ] Empty state real (`EmptyState` de `common/`).
- [ ] Ícone (`lucide-react`) discreto (`h-4 w-4 text-muted-foreground` em geral).
- [ ] `rg -i "homefin|lovable"` limpo no que é renderizado.
