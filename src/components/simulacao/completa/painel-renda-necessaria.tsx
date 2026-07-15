/**
 * Painel de renda necessária — exibido logo abaixo das tabelas de resultado
 * da simulação completa. Mostra em um card refinado a renda familiar mínima
 * estimada para SAC e/ou PRICE, comparando com a renda informada.
 */
import { Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import { avaliarRendaMinima } from "@/lib/simulacao/renda";
import { cn } from "@/lib/utils";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

type Sistema = "S" | "P";

function Linha({
  sistema,
  valorFinanciamento,
  valorImovel,
  prazoMeses,
  taxaAno,
  rendaInformada,
}: {
  sistema: Sistema;
  valorFinanciamento: number;
  valorImovel?: number | null;
  prazoMeses: number;
  taxaAno: number;
  rendaInformada?: number | null;
}) {
  const aval = avaliarRendaMinima({
    valor_financiamento: valorFinanciamento,
    valor_imovel: valorImovel,
    prazo_meses: prazoMeses,
    taxa_ano: taxaAno,
    renda_informada: rendaInformada,
    sistema,
  });
  if (!aval) return null;
  const insuficiente = aval.suficiente === false;
  const label = sistema === "P" ? "PRICE" : "SAC";
  const teto = sistema === "P" ? "15% da parcela inicial" : "30% da 1ª parcela";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border bg-card/60 px-4 py-3",
        insuficiente ? "border-amber-500/40" : "border-border/60",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold ring-1 ring-inset",
            sistema === "P"
              ? "bg-primary/10 text-primary ring-primary/20"
              : "bg-secondary text-secondary-foreground ring-border",
          )}
        >
          {label}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Renda familiar necessária</p>
          <p className="text-xs text-muted-foreground">
            Base de qualificação: {teto}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatBRL(aval.rendaMinima)}
          </p>
          {typeof rendaInformada === "number" && rendaInformada > 0 && (
            <p
              className={cn(
                "flex items-center justify-end gap-1 text-xs",
                insuficiente ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {insuficiente ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  Informada: {formatBRL(rendaInformada)}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Informada: {formatBRL(rendaInformada)}
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PainelRendaNecessaria({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, melhorTaxaAno, rendaConsiderada } = ctx;

  const valor = Number(f.valor_financiamento) || 0;
  if (valor <= 0 || f.prazo < 60) return null;

  const sistema = f.sistema_amortizacao;
  const ambos = sistema === "B";

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Wallet className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Renda familiar necessária</h3>
          <p className="text-xs text-muted-foreground">
            Estimativa conservadora para viabilizar a aprovação nos bancos selecionados.
          </p>
        </div>
      </div>
      <div className={cn("grid gap-2", ambos ? "sm:grid-cols-2" : "grid-cols-1")}>
        {ambos ? (
          <>
            <Linha
              sistema="S"
              valorFinanciamento={valor}
              valorImovel={f.valor_imovel}
              prazoMeses={f.prazo}
              taxaAno={melhorTaxaAno}
              rendaInformada={Number(f.renda_total) || 0}
            />
            <Linha
              sistema="P"
              valorFinanciamento={valor}
              valorImovel={f.valor_imovel}
              prazoMeses={f.prazo}
              taxaAno={melhorTaxaAno}
              rendaInformada={Number(f.renda_price) || 0}
            />
          </>
        ) : (
          <Linha
            sistema={sistema === "P" ? "P" : "S"}
            valorFinanciamento={valor}
            valorImovel={f.valor_imovel}
            prazoMeses={f.prazo}
            taxaAno={melhorTaxaAno}
            rendaInformada={rendaConsiderada}
          />
        )}
      </div>
    </div>
  );
}
