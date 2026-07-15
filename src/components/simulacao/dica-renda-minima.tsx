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

const TONE_STYLES: Record<Tone, { wrap: string; icon: string; label: string; text: string }> = {
  success: {
    wrap: "border-emerald-500/40 bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
    label: "text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-900 dark:text-emerald-100",
  },
  warning: {
    wrap: "border-amber-500/40 bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
    label: "text-amber-700 dark:text-amber-300",
    text: "text-amber-900 dark:text-amber-100",
  },
  danger: {
    wrap: "border-rose-500/40 bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
    label: "text-rose-700 dark:text-rose-300",
    text: "text-rose-900 dark:text-rose-100",
  },
  info: {
    wrap: "border-sky-500/40 bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    label: "text-sky-700 dark:text-sky-300",
    text: "text-sky-900 dark:text-sky-100",
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
        "mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm",
        s.wrap,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", s.icon)} aria-hidden />
      <div className="flex min-w-0 flex-1 items-baseline gap-2 leading-tight">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wide", s.label)}>
          {statusLabel}
        </span>
        <span className={cn("truncate text-sm font-bold tabular-nums", s.text)}>
          {formatBRL(rendaMin)}
        </span>
        <span className={cn("text-[10px] font-medium uppercase tracking-wider opacity-70", s.label)}>
          {sistema === "P" ? "PRICE" : "SAC"}
        </span>
      </div>
      {subtitulo && (
        <span className={cn("shrink-0 text-[11px] font-medium tabular-nums", s.label)}>
          {subtitulo}
        </span>
      )}
    </div>
  );
}
