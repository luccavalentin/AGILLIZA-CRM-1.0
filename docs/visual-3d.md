# Sistema 3D do Agilliza (C00, 26/10/2026)

Pedido do dono: "deve ter elementos 3D igual dos demais portais, profissional e sofisticado". O Agilliza
usa agora a mesma peça 3D dos portais dos assinantes do Agilliza Tech (`.b3d` em
`apps/web/src/components/shell/padrao-agilliza.css`): face em degradê do tom, lateral escura que dá
espessura e sombra colorida no chão. Pequena (20 a 48 px), sem brinquedo, parada para quem pediu menos
movimento (`prefers-reduced-motion` e o interruptor `html[data-crm-motion="off"]`).

CSS: bloco "Sistema 3D do Agilliza" no fim de `src/styles.css` (fora de `@layer`, de propósito).

## Componentes

| Componente | Arquivo | Para quê |
|---|---|---|
| `Icone3D` | `src/components/ui/icone-3d.tsx` | A peça 3D com um glifo lucide (ou um `<svg>` próprio). |
| `Indicador3D` | `src/components/ui/indicador-3d.tsx` | Cartão de indicador (KPI) com ícone 3D, variação e link para a lista. |
| `VariacaoSelo` | `src/components/ui/indicador-3d.tsx` | Selo "+12% / −3% / estável / novo" (verde = bom, vermelho = ruim). |
| `Estado3D` | `src/components/ui/estado-3d.tsx` | Vazio, erro e carregando desenhados. |
| `SubNavegacao` | `src/components/ui/sub-navegacao.tsx` | Abas entre telas irmãs de um submenu (Conta, Tecnologia). |

Já aplicado no que todas as telas herdam:

- **Menu lateral** (`src/components/app-shell/sidebar-nav.tsx`): cada ícone mora numa insígnia (28 px,
  24 nos filhos) com véu e fio de luz; a tela atual vira peça branca em relevo com o glifo azul. Vale no
  menu aberto, no recolhido (trilho) e na gaveta do celular.
- **Cabeçalho de página**: `PageHeader` (`src/components/shared/page-header.tsx`) e, por ele, o
  `AdminHero` (31 telas) desenham o ícone como `Icone3D` (tamanho `lg`). Nada muda em quem já passa
  `icon={<Shield className="h-5 w-5" />}`; para outra cor, `tom="sucesso"`.
- **Painéis** (`src/components/common/dashboard.tsx`): `PanelHeader` aceita `icone={Wallet}`;
  `HeroMetric` usa o `Icone3D` no tom do indicador.
- **Relatórios**: `EmptyReport` usa o `Estado3D`.

## Uso

```tsx
import { Icone3D } from "@/components/ui/icone-3d";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { SubNavegacao } from "@/components/ui/sub-navegacao";

<Icone3D icone={Wallet} tom="sucesso" tamanho="md" />

<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <Indicador3D
    icone={Send}
    rotulo="Propostas enviadas"
    natureza="quantidade"
    valor="128"
    variacao={{ pct: 12, sobe: true, bom: true }}
    detalhe="vs. 30 dias antes"
    link={{ to: "/operacional/propostas", search: { status: "enviada" } }}
  />
</div>

{lista.length === 0 && (
  <Estado3D icone={FileSearch} titulo="Nenhuma proposta no período"
    descricao="Amplie o período ou limpe os filtros." acao={<Button>Limpar filtros</Button>} />
)}
{erro && <Estado3D tipo="erro" descricao={erro.message} acao={<Button onClick={() => refetch()}>Tentar de novo</Button>} />}

<SubNavegacao rotulo="Conta" itens={[
  { to: "/conta/perfil", rotulo: "Meus dados", icone: UserRound },
  { to: "/conta/seguranca", rotulo: "Segurança", icone: Lock, tom: "sucesso" },
]} />
```

### Tamanhos

`xs` 20 px (linha de lista densa) · `sm` 24 px (abas, itens) · `md` 30 px (cartão de indicador, padrão) ·
`lg` 38 px (cabeçalho de página, indicador em destaque) · `xl` 48 px (estado vazio).

### Tons

`marca` (azul #000F9F, padrão) · `sucesso` (verde) · `alerta` (âmbar) · `perigo` (vermelho, **só alerta**) ·
`info` (azul-céu) · `neutro` (grafite) · `violeta` · `ciano`. Os tons antigos dos painéis (`brand`,
`success`, `warning`, `danger`, `neutral`) são traduzidos por `tomIcone3D()`.

### Inclinação

O ícone inclina de leve quando o **pai** com a classe `i3d-grupo` é apontado (o `Indicador3D` e o
`Estado3D` já têm). Em cartões próprios: `<Link className="i3d-grupo ...">`.

## Regras

- Um ícone 3D por cartão; ícone de interface (botões, campos, tabelas) continua de traço fino.
- Vermelho só para alerta ou perigo de verdade.
- Número: `Indicador3D` mostra a natureza (`natureza="R$"`, `"quantidade"`) e a variação contra o período
  anterior de mesma duração; quando não há base anterior, o selo diz "novo" em vez de inventar %.
- Sem dado não é zero: use `Estado3D` ou "sem dados" no lugar do número.
- O modo escuro do Agilliza só escurece o menu (o conteúdo continua branco); a central de tecnologia tem
  tema escuro próprio e a peça 3D funciona sobre ele sem ajuste.
