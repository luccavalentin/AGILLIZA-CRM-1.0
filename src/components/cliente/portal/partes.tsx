import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/financeiro/format";
import { rotuloIdProposta, statusProposta, type TomStatus } from "@/lib/portal/jornada";
import type { PropostaCliente } from "@/lib/portal/cliente-portal.functions";

/** Cartão do portal: borda fina, sombra leve, o "bloco" dos portais dos assinantes. */
export function Bloco({
  titulo,
  icone: Icone,
  acao,
  children,
  className,
}: {
  titulo?: string;
  icone?: LucideIcon;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5", className)}>
      {(titulo || acao) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {titulo && (
            <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-foreground">
              {Icone && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icone className="size-4" />
                </span>
              )}
              <span className="truncate">{titulo}</span>
            </h2>
          )}
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

const TOM: Record<TomStatus, string> = {
  sucesso: "bg-success/10 text-success-texto border-success/20",
  info: "bg-primary/10 text-primary border-primary/15",
  alerta: "bg-warning/15 text-warning-foreground border-warning/30",
  neutro: "bg-muted text-muted-foreground border-border",
  perigo: "bg-destructive/10 text-destructive border-destructive/20",
};

export function Selo({ tom, children }: { tom: TomStatus; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", TOM[tom])}>
      {children}
    </span>
  );
}

/** Proposta com o banco, o status em português e o ID H. visível. */
export function CartaoProposta({ p, detalhada = false }: { p: PropostaCliente; detalhada?: boolean }) {
  const st = statusProposta(p.status);
  const id = rotuloIdProposta(p.id_h);
  return (
    <article className="rounded-xl border border-border bg-background p-3.5">
      <div className="flex items-start gap-3">
        <BancoLogo nome={p.banco} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-semibold text-foreground">{p.banco ?? "Banco"}</p>
            <Selo tom={st.tom}>{st.rotulo}</Selo>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {id ? <span className="font-medium tabular-nums text-foreground">{id}</span> : "ID em definição"}
            {p.produto ? ` · ${p.produto}` : ""}
          </p>
        </div>
      </div>
      <dl className={cn("mt-3 grid gap-2 text-sm", detalhada ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        <Valor rotulo={p.valor_aprovado ? "Valor aprovado" : "Valor financiado"} valor={formatBRL(p.valor_aprovado ?? p.valor ?? 0)} />
        <Valor rotulo="Parcela" valor={p.parcela ? formatBRL(p.parcela) : "—"} />
        {detalhada && <Valor rotulo="Taxa ao ano" valor={p.taxa_ano ? `${Number(p.taxa_ano).toFixed(2).replace(".", ",")}%` : "—"} />}
        {detalhada && <Valor rotulo="Prazo" valor={p.prazo ? `${p.prazo} meses` : "—"} />}
      </dl>
    </article>
  );
}

function Valor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-2.5 py-2">
      <dt className="truncate text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-semibold tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}

/** Atalho do início (número grande, rótulo e para onde leva). */
export function Atalho({
  icone: Icone,
  rotulo,
  valor,
  dica,
  to,
  destaque = false,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  dica?: string;
  to: string;
  destaque?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        destaque ? "border-warning/40" : "border-border/70",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          destaque ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        )}
      >
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-bold leading-tight tabular-nums text-foreground">{valor}</p>
        <p className="truncate text-xs font-medium text-muted-foreground">{rotulo}</p>
        {dica && <p className="truncate text-[11px] text-muted-foreground/80">{dica}</p>}
      </div>
      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-40 w-full rounded-2xl" />
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ErroCarregar({ mensagem, aoTentar, ocupado }: { mensagem: string; aoTentar: () => void; ocupado?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card p-8 text-center">
      <p className="text-sm text-destructive">{mensagem}</p>
      <Button variant="outline" size="sm" disabled={ocupado} onClick={aoTentar}>
        Tentar de novo
      </Button>
    </div>
  );
}

export function Vazio({ icone: Icone, titulo, texto, acao }: { icone: LucideIcon; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icone className="size-6" />
      </span>
      <div>
        <p className="font-medium text-foreground">{titulo}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>
      </div>
      {acao}
    </div>
  );
}
