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
  prazoMeses,
  taxaAno,
  sistema,
  rendaInformada,
}: {
  valorFinanciamento: number;
  prazoMeses: number;
  taxaAno: number;
  sistema: SistemaAmortizacao;
  rendaInformada?: number | null;
}) {
  const av = avaliarRendaMinima({
    valor_financiamento: valorFinanciamento,
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

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "success" && "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
        tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        tone === "info" && "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-0.5">
        <p>
          A renda familiar mensal mínima para esse valor é aproximadamente{" "}
          <span className="font-semibold">{formatBRL(av.rendaMinima)}</span>.
        </p>
        <p className="text-xs opacity-90">
          Estimativa considerando parcela inicial de {formatBRL(av.primeiraParcela)} e o teto de 30%
          de comprometimento de renda.
        </p>
        {av.suficiente === true && (
          <p className="text-xs font-medium">
            A renda informada ({formatBRL(rendaInformada ?? 0)}) está dentro do exigido
            {av.comprometimento != null &&
              ` — comprometimento de ${(av.comprometimento * 100).toFixed(0)}%.`}
          </p>
        )}
        {av.suficiente === false && (
          <p className="text-xs font-medium">
            A renda informada ({formatBRL(rendaInformada ?? 0)}) está abaixo do mínimo exigido. É
            preciso reduzir o valor do crédito, aumentar o prazo ou compor renda.
          </p>
        )}
      </div>
    </div>
  );
}
