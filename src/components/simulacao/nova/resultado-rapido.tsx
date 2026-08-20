import { forwardRef } from "react";
import { Award, Download, Send, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
import { formatBRL, formatTaxa } from "@/lib/simulacao/format";

interface Comparativo {
  banco_id: string;
  nome_banco: string;
  taxa_ano: number;
  resultado: { primeira_parcela: number; ultima_parcela: number };
}

interface Props {
  comparativo: Comparativo[];
  valorFinanciamento: number;
  prazoMeses: number;
  sistema?: "SAC" | "PRICE";
  baixando: boolean;
  onBaixar: (bancoId?: string) => void;
  onEnviar: (bancoId?: string) => void;
}

export const ResultadoRapido = forwardRef<HTMLDivElement, Props>(function ResultadoRapido(
  { comparativo, valorFinanciamento, prazoMeses, sistema = "SAC", baixando, onBaixar, onEnviar },
  ref,
) {
  return (
    <Card
      ref={ref}
      className="scroll-mt-4 overflow-hidden border-primary/30 shadow-lg ring-1 ring-primary/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
              Resultado — Simulação rápida
            </h2>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-[12px] font-semibold text-primary ring-1 ring-inset ring-primary/20">
              {sistema} · {prazoMeses} meses
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Financiamento:{" "}
            <span className="font-bold tabular-nums text-foreground">
              {formatBRL(valorFinanciamento)}
            </span>
            {" · "}
            Estimativa baseada nas taxas médias praticadas pelos bancos.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-primary/20 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10"
          onClick={() => onBaixar()}
          disabled={baixando}
        >
          <Download className="h-4 w-4" />
          {baixando ? "Gerando..." : "Baixar Comparativo"}
        </Button>
      </div>

      <div className="p-4 sm:p-5">
        {comparativo.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum banco habilitado. Ative bancos em Configurações → Bancos.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {comparativo.map((c, i) => (
              <BancoResultadoCard
                key={c.banco_id}
                c={c}
                melhor={i === 0 && comparativo.length > 1}
                prazoMeses={prazoMeses}
                valorFinanciamento={valorFinanciamento}
                onBaixar={onBaixar}
                baixando={baixando}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});

function BancoResultadoCard({
  c,
  melhor,
  prazoMeses,
  valorFinanciamento,
  onBaixar,
  baixando,
}: {
  c: Comparativo;
  melhor: boolean;
  prazoMeses: number;
  valorFinanciamento: number;
  onBaixar: (bancoId?: string) => void;
  baixando: boolean;
}) {
  const cor = corDoBanco(c.nome_banco);
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
        melhor && "ring-2 ring-primary/40 bg-gradient-to-b from-primary/[0.02] to-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <BancoLogo nome={c.nome_banco} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight" style={{ color: cor }}>
              {c.nome_banco}
            </div>
            <div className="mt-0.5">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                Simulação
              </span>
            </div>
          </div>
        </div>
        {melhor && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Award className="h-3 w-3" /> Melhor
          </span>
        )}
      </div>

      <dl className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/50 bg-muted/30">
        <Info label="Parcela inicial" value={formatBRL(c.resultado.primeira_parcela)} emphasis />
        <Info label="Taxa a.a." value={formatTaxa(c.taxa_ano)} />
        <Info label="Prazo" value={`${prazoMeses} meses`} />
        <Info label="Financ. máx" value={formatBRL(valorFinanciamento)} />
        <Info label="Renda mínima" value={formatBRL(c.resultado.primeira_parcela / 0.3)} emphasis />
        <Info label="Última parcela" value={formatBRL(c.resultado.ultima_parcela)} />
      </dl>

      <div className="mt-auto flex items-center justify-end pt-2">
        <Button
          size="sm"
          variant="default"
          className="h-9 w-full gap-2 rounded-xl text-xs font-semibold shadow-sm transition-transform active:scale-95"
          onClick={() => onBaixar(c.banco_id)}
          disabled={baixando}
        >
          <Download className="h-4 w-4" /> {baixando ? "Gerando..." : "Baixar PDF"}
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate text-right text-[15px] tabular-nums text-foreground",
          emphasis ? "font-bold text-primary" : "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
