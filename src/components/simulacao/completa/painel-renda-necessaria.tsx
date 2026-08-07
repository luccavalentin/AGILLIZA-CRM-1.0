/**
 * Painel de renda necessária — exibido logo abaixo das tabelas de resultado
 * da simulação completa. Mostra em um card refinado a renda familiar mínima
 * estimada para SAC e/ou PRICE, comparando com a renda informada.
 */
import { Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import { avaliarRendaMinima, rendaMinimaSugerida, calcularMaximoFinanciável } from "@/lib/simulacao/renda";
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

export function PainelRendaNecessaria({ ctx }: { ctx: any }) {
  const { f, melhorTaxaAno, rendaConsiderada, dataSimulacao } = ctx;

  const valor = Number(f.valor_financiamento) || 0;
  if (valor <= 0 || f.prazo < 60) return null;

  const sistema = f.sistema_amortizacao;
  const ambos = sistema === "B";

  // Renda Sugerida Única (Parte 4)
  const sugerida = rendaMinimaSugerida({
    valor_imovel: Number(f.valor_imovel) || 0,
    valor_financiamento: valor,
    prazo_meses: f.prazo,
    taxa_ano: melhorTaxaAno,
    bancos_simulados: dataSimulacao?.bancos || [],
    renda_informada: rendaConsiderada,
  });

  const insuficiente = sugerida.suficiente === false;
  
  // Cálculo Inverso (Parte 2)
  const maxFinan = calcularMaximoFinanciável({
    renda_declarada: rendaConsiderada,
    prazo_meses: f.prazo,
    taxa_ano: melhorTaxaAno,
    sistema: sistema === "P" ? "P" : "S",
    valor_imovel: Number(f.valor_imovel) || 0,
  });

  return (
    <div className="space-y-3">
      <div className={cn(
        "rounded-xl border p-4 sm:p-5 transition-all duration-300",
        insuficiente 
          ? "border-amber-500/50 bg-amber-500/[0.03] shadow-inner" 
          : "border-primary/20 bg-gradient-to-br from-primary/[0.03] via-card to-card"
      )}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset",
                insuficiente ? "bg-amber-500/10 text-amber-600 ring-amber-500/20" : "bg-primary/10 text-primary ring-primary/20"
            )}>
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Renda mínima sugerida</h3>
              <p className="text-[11px] text-muted-foreground">
                Renda estimada necessária: SAC / PRICE. Cada instituição aplica regra própria — a simulação será enviada a todos os bancos selecionados.
              </p>

            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-xl font-black tabular-nums", insuficiente ? "text-amber-600" : "text-primary")}>
              {formatBRL(sugerida.rendaMinima)}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {sugerida.detalhe_fonte}
            </p>
          </div>
        </div>

        {insuficiente && (
          <div className="mt-4 rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/20">
            <div className="flex gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-amber-700">Renda insuficiente para o financiamento atual</p>
                <p className="text-[11px] leading-relaxed text-amber-600/90">
                  A renda declarada de <span className="font-bold">{formatBRL(rendaConsiderada)}</span> está abaixo do piso sugerido.
                  Com esta renda, o valor máximo financiável estimado é de <span className="font-bold text-foreground">{formatBRL(maxFinan)}</span>.
                </p>
              </div>
            </div>
          </div>
        )}
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
