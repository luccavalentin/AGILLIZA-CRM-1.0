import { forwardRef } from "react";
import { Award, Download, Send, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";

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
  onBaixar: () => void;
  onEnviar: () => void;
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              Resultado — Simulação rápida
            </h2>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {sistema} · {prazoMeses} meses
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Financiamento:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(valorFinanciamento)}
            </span>
            {" · "}
            Estimativa baseada nas taxas médias praticadas pelos bancos. Para enviar ao banco,
            prossiga para a simulação completa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {comparativo.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onBaixar}
              disabled={baixando}
            >
              <Download className="h-3.5 w-3.5" />
              {baixando ? "Gerando…" : "Baixar"}
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={onEnviar}>
            <Send className="h-3.5 w-3.5" /> Enviar ao banco
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {comparativo.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum banco habilitado. Ative bancos em Configurações → Bancos.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {comparativo.map((c, i) => (
              <BancoResultadoCard
                key={c.banco_id}
                c={c}
                melhor={i === 0 && comparativo.length > 1}
                prazoMeses={prazoMeses}
                valorFinanciamento={valorFinanciamento}
                onEnviar={onEnviar}
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
  onEnviar,
}: {
  c: Comparativo;
  melhor: boolean;
  prazoMeses: number;
  valorFinanciamento: number;
  onEnviar: () => void;
}) {
  const cor = corDoBanco(c.nome_banco);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition hover:shadow-md",
        melhor && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BancoLogo nome={c.nome_banco} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" style={{ color: cor }}>
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

      <dl className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/50 bg-muted/20">
        <Info label="Parcela inicial" value={formatBRL(c.resultado.primeira_parcela)} emphasis />
        <Info label="Taxa a.a." value={formatPercent(c.taxa_ano)} />
        <Info label="Prazo" value={`${prazoMeses} meses`} />
        <Info label="Financ. máx" value={formatBRL(valorFinanciamento)} />
        <Info label="Última parcela" value={formatBRL(c.resultado.ultima_parcela)} />
      </dl>

      <div className="mt-auto flex items-center justify-end pt-1">
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={onEnviar}>
          <Send className="h-3 w-3" /> Enviar
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate text-right text-sm tabular-nums text-foreground",
          emphasis ? "font-semibold text-primary" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
