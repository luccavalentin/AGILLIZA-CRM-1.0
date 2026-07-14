/**
 * Dica de renda mínima exigida para o valor de financiamento informado.
 * Mostra SAC e PRICE lado a lado, destacando o sistema selecionado, para que
 * o usuário tenha ciência da renda exigida ANTES de enviar ao banco (evita
 * rejeição por comprometimento de renda).
 */
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import {
  avaliarRendaMinima,
  rendaMinimaPelosBancos,
  type BancoRendaApi,
  type AvaliacaoRenda,
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

export function DicaRendaMinima(props: Props) {
  const { valorFinanciamento, valorImovel, prazoMeses, taxaAno, sistema, rendaInformada, bancos } = props;

  // 1) Se algum banco já retornou parcela real, prevalece — é o número oficial.
  const apiEval = rendaMinimaPelosBancos(bancos, rendaInformada);

  // 2) Estimativa local para AMBOS os sistemas (para comparação clara).
  const params = {
    valor_financiamento: valorFinanciamento,
    valor_imovel: valorImovel,
    prazo_meses: prazoMeses,
    taxa_ano: taxaAno,
    renda_informada: rendaInformada,
  } as const;
  const sacEval = avaliarRendaMinima({ ...params, sistema: "S" });
  const priceEval = avaliarRendaMinima({ ...params, sistema: "P" });

  // Sistema selecionado é o principal.
  const principal = apiEval ?? (sistema === "P" ? priceEval : sacEval);
  if (!principal) return null;

  const tone: "success" | "warning" | "info" =
    principal.suficiente == null ? "info" : principal.suficiente ? "success" : "warning";
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : Info;

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
    <div className={cn("rounded-xl border p-4", toneStyles.wrap)}>
      <div className="flex items-start gap-3">
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
            <span className="text-sm font-medium text-foreground">Renda familiar estimada</span>
            <span className="text-base font-bold text-foreground">
              {formatBRL(principal.rendaMinima)}
            </span>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {apiEval ? "retorno bancário" : sistema === "P" ? "PRICE" : "SAC"}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {apiEval
              ? "Renda exigida pelo retorno bancário mais conservador"
              : "Renda necessária para o valor financiado"}
            {principal.bancoNome ? ` (${principal.bancoNome})` : ""}, com prestação inicial de{" "}
            <span className="font-medium text-foreground/80">{formatBRL(principal.primeiraParcela)}</span>{" "}
            e no teto de 30% de comprometimento de renda.
          </p>

          {principal.suficiente === true && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                toneStyles.pill,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Renda informada aprovada
              {principal.comprometimento != null &&
                ` · comprometimento de ${(principal.comprometimento * 100).toFixed(0)}%`}
            </div>
          )}

          {principal.suficiente === false && (
            <div className="space-y-1">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold",
                  toneStyles.pill,
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Abaixo do mínimo exigido
                {principal.comprometimento != null &&
                  ` · comprometimento de ${(principal.comprometimento * 100).toFixed(0)}%`}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reduza o valor do crédito, aumente o prazo ou componha renda com um cônjuge/coobrigado.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Comparativo SAC × PRICE (estimativa local) */}
      {!apiEval && sacEval && priceEval && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
          <SistemaCard
            label="SAC"
            ativo={sistema === "S"}
            av={sacEval}
          />
          <SistemaCard
            label="PRICE"
            ativo={sistema === "P"}
            av={priceEval}
          />
        </div>
      )}
    </div>
  );
}

function SistemaCard({ label, ativo, av }: { label: string; ativo: boolean; av: AvaliacaoRenda }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition",
        ativo
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : "border-border/60 bg-background/40 opacity-80",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {ativo && (
          <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
            selecionado
          </span>
        )}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{formatBRL(av.rendaMinima)}</div>
      <div className="text-[11px] text-muted-foreground">
        parcela inicial {formatBRL(av.primeiraParcela)}
      </div>
    </div>
  );
}
