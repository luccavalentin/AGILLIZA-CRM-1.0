/**
 * Dica de renda mínima exigida para o valor de financiamento informado.
 * Reutilizável nas simulações rápida e completa.
 */
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import { avaliarRendaMinima } from "@/lib/simulacao/renda";
import type { SistemaAmortizacao } from "@/lib/simulacao/simulacao-rapida";
import { cn } from "@/lib/utils";

export function DicaRendaMinima({
  valorFinanciamento,
  valorImovel,
  prazoMeses,
  taxaAno,
  sistema,
  rendaInformada,
}: {
  valorFinanciamento: number;
  valorImovel?: number | null;
  prazoMeses: number;
  taxaAno: number;
  sistema: SistemaAmortizacao;
  rendaInformada?: number | null;
}) {
  const av = avaliarRendaMinima({
    valor_financiamento: valorFinanciamento,
    valor_imovel: valorImovel,
    prazo_meses: prazoMeses,
    taxa_ano: taxaAno,
    sistema,
    renda_informada: rendaInformada,
  });

  if (!av) return null;

  const tone =
    av.suficiente == null ? "info" : av.suficiente ? "success" : "warning";

  const Icon =
    tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : Info;

  const toneStyles = {
    success: {
      wrap: "border-emerald-500/30 bg-emerald-500/5",
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      pill: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
    },
    warning: {
      wrap: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      pill: "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950",
    },
    info: {
      wrap: "border-border bg-muted/40",
      badge: "bg-muted text-muted-foreground",
      pill: "bg-foreground/80 text-background",
    },
  }[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        toneStyles.wrap,
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          toneStyles.badge,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-foreground">
            Renda familiar mínima estimada
          </span>
          <span className="text-base font-bold text-foreground">
            {formatBRL(av.rendaMinima)}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Baseado na parcela inicial de{" "}
          <span className="font-medium text-foreground/80">
            {formatBRL(av.primeiraParcela)}
          </span>{" "}
          pelo sistema{" "}
          <span className="font-medium text-foreground/80">
            {sistema === "P" ? "PRICE" : "SAC"}
          </span>{" "}
          e no teto de 30% de comprometimento de renda.
        </p>


        {av.suficiente === true && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
              toneStyles.pill,
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Renda informada aprovada
            {av.comprometimento != null &&
              ` · comprometimento de ${(av.comprometimento * 100).toFixed(0)}%`}
          </div>
        )}

        {av.suficiente === false && (
          <div className="space-y-1">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                toneStyles.pill,
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Abaixo do mínimo exigido
              {av.comprometimento != null &&
                ` · comprometimento de ${(av.comprometimento * 100).toFixed(0)}%`}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Reduza o valor do crédito, aumente o prazo ou componha renda com um
              cônjuge/coobrigado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
