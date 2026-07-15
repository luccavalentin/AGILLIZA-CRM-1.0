/**
 * Indicador compacto de renda necessária, exibido como um "chip/card" colorido
 * logo abaixo do campo de renda familiar. A cor reflete a folga da renda
 * informada em relação à renda mínima estimada (verde/amarelo/vermelho).
 */
import { AlertTriangle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import {
  avaliarRendaMinima,
  rendaMinimaPelosBancos,
  type BancoRendaApi,
} from "@/lib/simulacao/renda";
import type { SistemaAmortizacao } from "@/lib/simulacao/simulacao-rapida";
import { cn } from "@/lib/utils";

interface Props {
  valorFinanciamento: number;
  valorImovel?: number | null;
  prazoMeses: number;
  taxaAno: number;
  sistema: SistemaAmortizacao;
  rendaInformada?: number | null;
  bancos?: BancoRendaApi[] | null;
}

type Tone = "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<Tone, { accent: string; iconBox: string; icon: string; status: string }> = {
  success: {
    accent: "bg-success",
    iconBox: "bg-success/10 ring-success/20",
    icon: "text-success",
    status: "text-success",
  },
  warning: {
    accent: "bg-warning",
    iconBox: "bg-warning/15 ring-warning/25",
    icon: "text-warning-foreground",
    status: "text-warning-foreground",
  },
  danger: {
    accent: "bg-destructive",
    iconBox: "bg-destructive/10 ring-destructive/20",
    icon: "text-destructive",
    status: "text-destructive",
  },
  info: {
    accent: "bg-primary",
    iconBox: "bg-primary/10 ring-primary/20",
    icon: "text-primary",
    status: "text-primary",
  },
};

export function DicaRendaMinima(props: Props) {
  const { valorFinanciamento, valorImovel, prazoMeses, taxaAno, sistema, rendaInformada, bancos } = props;

  const apiEval = rendaMinimaPelosBancos(bancos, rendaInformada);
  const local = avaliarRendaMinima({
    valor_financiamento: valorFinanciamento,
    valor_imovel: valorImovel,
    prazo_meses: prazoMeses,
    taxa_ano: taxaAno,
    renda_informada: rendaInformada,
    sistema,
  });

  const principal = apiEval ?? local;
  if (!principal) return null;

  const rendaMin = principal.rendaMinima;
  const informada = Number(rendaInformada ?? 0);

  // Define tom pela folga da renda informada em relação à mínima
  let tone: Tone = "info";
  let Icon = Info;

  if (informada > 0 && rendaMin > 0) {
    const ratio = informada / rendaMin;
    if (ratio >= 1) {
      tone = "success";
      Icon = CheckCircle2;
    } else if (ratio >= 0.85) {
      tone = "warning";
      Icon = TriangleAlert;
    } else {
      tone = "danger";
      Icon = AlertTriangle;
    }
  }

  const s = TONE_STYLES[tone];

  return (
    <div className="mt-2 flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", s.icon)} aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">Renda necessária</span>
      </div>
      <p className={cn("font-mono text-sm font-semibold tabular-nums", s.status)}>
        {formatBRL(rendaMin)}
      </p>
    </div>
  );
}
