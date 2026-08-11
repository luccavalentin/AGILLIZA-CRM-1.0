/**
 * Componentes de apresentação puramente visuais usados pela página de
 * detalhe da simulação. Extraídos de
 * `routes/_authenticated/operacional.simulacoes_.$id.tsx` sem qualquer
 * alteração de estilo ou comportamento.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { extrairDetalheBanco } from "@/lib/simulacao/detalhe-banco";

/** Valor total financiado do banco (financiamento + despesas/tarifas financiadas). */
export function totalFinanciado(b: any): number | null {
  const d = extrairDetalheBanco(b?.raw_response);
  return d?.financiamentoTotal ?? d?.valorFinanciamento ?? b?.valor_financiamento_max ?? null;
}

export function AmortizacaoTag({ sistema }: { sistema: "SAC" | "PRICE" }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-[5px] border border-primary/25 bg-primary/[0.08] px-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary"
      title={`Tabela ${sistema}`}
      aria-label={`Tabela ${sistema}`}
    >
      {sistema}
    </span>
  );
}

export function ResumoCelula({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className={cn("relative bg-card p-3.5 transition-colors", destaque && "bg-primary/5")}>
      {destaque && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {rotulo}
      </dt>
      <dd
        className={cn(
          "mt-1.5 text-[15px] font-semibold tabular-nums",
          destaque ? "text-primary" : "text-foreground",
        )}
      >
        {valor}
      </dd>
      {detalhe && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  S: "Solteiro(a)",
  C: "Casado(a)",
  D: "Divorciado(a)",
  V: "Viúvo(a)",
  U: "União estável",
};

export function estadoCivilLabel(v?: string | null): string {
  if (!v) return "—";
  return ESTADO_CIVIL_LABELS[v.toUpperCase()] ?? v;
}

export function GrupoDados({
  titulo,
  icone,
  children,
  ultimo,
}: {
  titulo: string;
  icone: ReactNode;
  children: ReactNode;
  ultimo?: boolean;
}) {
  return (
    <div className={cn(!ultimo && "border-b border-border/50")}>
      <div className="flex items-center gap-2.5 border-b border-border/40 bg-gradient-to-r from-muted/50 to-transparent px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          {icone}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-foreground/90">
          {titulo}
        </h3>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </dl>
    </div>
  );
}

export function Campo({
  termo,
  desc,
  destaque,
}: {
  termo: string;
  desc: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative px-4 py-3 transition-colors duration-200",
        destaque ? "bg-primary/5" : "bg-card hover:bg-muted/40",
      )}
    >
      {destaque && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
      )}
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {termo}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[15px] font-semibold tabular-nums leading-tight",
          destaque ? "text-primary" : "text-foreground",
        )}
      >
        {desc}
      </dd>
    </div>
  );
}

export function MobileStat({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-medium tabular-nums">{valor}</dd>
    </div>
  );
}
