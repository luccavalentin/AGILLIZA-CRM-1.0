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
  let statusLabel = "Renda necessária";
  let Icon = Info;
  let subtitulo: string | null = null;

  if (informada > 0 && rendaMin > 0) {
    const ratio = informada / rendaMin;
    const folga = informada - rendaMin;
    if (ratio >= 1.15) {
      tone = "success";
      Icon = CheckCircle2;
      statusLabel = "Renda confortável";
      subtitulo = `Folga de ${formatBRL(folga)}`;
    } else if (ratio >= 1) {
      tone = "success";
      Icon = CheckCircle2;
      statusLabel = "Renda suficiente";
      subtitulo = `Folga de ${formatBRL(folga)}`;
    } else if (ratio >= 0.85) {
      tone = "warning";
      Icon = TriangleAlert;
      statusLabel = "Renda no limite";
      subtitulo = `Faltam ${formatBRL(-folga)}`;
    } else {
      tone = "danger";
      Icon = AlertTriangle;
      statusLabel = "Renda insuficiente";
      subtitulo = `Faltam ${formatBRL(-folga)}`;
    }
  }

  const s = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "mt-2 grid grid-cols-[3px_1fr] overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm ring-1 ring-border/40",
      )}
    >
      <div className={cn("h-full", s.accent)} aria-hidden />
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md ring-1", s.iconBox)}>
          <Icon className={cn("h-4 w-4", s.icon)} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", s.status)}>
              {statusLabel}
            </span>
            <span className="inline-flex h-5 items-center rounded-[5px] border border-primary/20 bg-primary/[0.06] px-1.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
              Tabela {sistema === "P" ? "PRICE" : "SAC"}
            </span>
          </div>
          {subtitulo && (
            <p className="mt-0.5 truncate text-[11px] font-medium tabular-nums text-muted-foreground">
              {subtitulo}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Renda mínima
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(rendaMin)}
          </p>
        </div>
      </div>
    </div>
  );
}
