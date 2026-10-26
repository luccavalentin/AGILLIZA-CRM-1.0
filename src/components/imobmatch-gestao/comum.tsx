/**
 * Peças comuns do ImobMatch Gestão: a marca do ImobMatch, rótulos de produto, canal e
 * situação, cores dos gráficos e a barra de proporção. Sem regra de negócio (é do banco).
 */
import type { ReactNode } from "react";
import { Selo, type Tom } from "@/components/plataforma/kit";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import type { ProdutoImobMatch, SituacaoFatura } from "@/lib/plataforma/imobmatch-gestao.functions";

export const CHAVE_IMOBMATCH_GESTAO = ["imobmatch-gestao"] as const;

/**
 * Símbolo do ImobMatch (telhado + coração), o mesmo do portal (`apps/imobmatch/public/favicon.svg`
 * do Corretor). No Agilliza o conteúdo fica claro também no modo escuro (só o menu escurece),
 * então as cores são as da marca, fixas.
 */
export function SimboloImobMatch({
  className,
  titulo = "ImobMatch",
}: {
  className?: string;
  titulo?: string;
}) {
  return (
    <svg
      viewBox="28 30 456 456"
      role="img"
      aria-label={titulo}
      className={cn("shrink-0", className)}
    >
      <path
        d="M104 186L256 88L408 186"
        fill="none"
        stroke="#F4313F"
        strokeWidth="58"
        strokeLinejoin="miter"
      />
      <path
        d="M256 436C175.9 385 125 341.4 125 283.1C125 238 157 206 199.2 206C225.4 206 245.8 219.1 256 240.9C266.2 219.1 286.6 206 312.8 206C355 206 387 238 387 283.1C387 341.4 336.1 385 256 436Z"
        fill="none"
        stroke="#0B109F"
        strokeWidth="60"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Assinatura "ImobMatch" com o símbolo (cabeçalho do módulo). */
export function MarcaImobMatch({
  className,
  compacta,
}: {
  className?: string;
  compacta?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SimboloImobMatch className={compacta ? "size-5" : "size-7"} />
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground",
          compacta ? "text-sm" : "text-lg",
        )}
      >
        Imob<span className="text-[#F4313F]">Match</span>
      </span>
    </span>
  );
}

export const PRODUTOS: ProdutoImobMatch[] = ["pro", "anunciante", "patrocinio"];

export const ROTULO_PRODUTO: Record<ProdutoImobMatch, string> = {
  pro: "ImobMatch Pro",
  anunciante: "Anunciante particular",
  patrocinio: "Patrocínio (banners)",
};

export const ROTULO_PRODUTO_CURTO: Record<ProdutoImobMatch, string> = {
  pro: "Pro",
  anunciante: "Anunciante",
  patrocinio: "Patrocínio",
};

/** Cores categóricas dos produtos (distintas no claro e no escuro; não usam vermelho/amarelo de alerta). */
export const COR_PRODUTO: Record<ProdutoImobMatch, string> = {
  pro: "var(--chart-1)",
  anunciante: "var(--chart-3)",
  patrocinio: "#7c5cff",
};

export const ROTULO_CANAL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  apple: "App Store",
  google: "Google Play",
  site: "Site (sem forma)",
};
export const rotuloCanal = (c: string) => ROTULO_CANAL[c] ?? c;

export const SITUACAO_FATURA: Record<SituacaoFatura, { rotulo: string; tom: Tom }> = {
  paga: { rotulo: "Paga", tom: "sucesso" },
  pendente: { rotulo: "A vencer", tom: "info" },
  vencida: { rotulo: "Vencida", tom: "perigo" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
  estornada: { rotulo: "Estornada", tom: "alerta" },
};

export function SeloProduto({ produto }: { produto: ProdutoImobMatch }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: COR_PRODUTO[produto] }}
        aria-hidden
      />
      <span className="truncate">{ROTULO_PRODUTO_CURTO[produto]}</span>
    </span>
  );
}

export function SeloSituacao({ situacao }: { situacao: SituacaoFatura }) {
  const s = SITUACAO_FATURA[situacao] ?? { rotulo: situacao, tom: "neutro" as Tom };
  return (
    <Selo tom={s.tom} ponto={situacao === "vencida"}>
      {s.rotulo}
    </Selo>
  );
}

export const inteiro = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("pt-BR");
export const moeda = (n: number | null | undefined) => formatBRL(Number(n ?? 0));

/** "R$ 12,3 mil" — para eixos de gráfico (espaço que não quebra: o rótulo fica numa linha). */
export function moedaCompacta(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const texto =
    Math.abs(v) < 1000
      ? Math.round(v).toLocaleString("pt-BR")
      : v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  return `R$ ${texto}`.replace(/\s/g, "\u00a0");
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-10" → "out/26". */
export function mesCurto(aaaamm: string): string {
  const [a, m] = aaaamm.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${(a ?? "").slice(2)}`;
}

/** Variação percentual entre dois valores (null quando não há base). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Barra fina de proporção (parte do total), para listas por produto e por canal. */
export function BarraProporcao({
  valor,
  total,
  cor,
}: {
  valor: number;
  total: number;
  cor: string;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: cor }}
      />
    </div>
  );
}

/** Linha de número numa seção (rótulo à esquerda, valor à direita). */
export function LinhaNumero({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  detalhe?: ReactNode;
  destaque?: "perigo" | "alerta" | "sucesso";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/60">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{rotulo}</p>
        {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-medium tabular-nums",
          destaque === "perigo" && "text-destructive",
          destaque === "alerta" && "text-warning-foreground",
          destaque === "sucesso" && "text-success-texto",
        )}
      >
        {valor}
      </p>
    </div>
  );
}

/** Estilo dos gráficos (mesmo das outras telas da gestão). */
export const GRAFICO = {
  eixo: "var(--muted-foreground)",
  grade: "color-mix(in oklab, var(--border) 70%, transparent)",
  dica: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    padding: "8px 12px",
  },
};
