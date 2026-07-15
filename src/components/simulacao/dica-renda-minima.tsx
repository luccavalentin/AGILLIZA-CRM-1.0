/**
 * Indicador enxuto de renda necessária para o financiamento informado.
 * Renderiza uma única linha compacta, para ser exibida logo abaixo do
 * campo de renda familiar — sem cards grandes nem comparativos.
 */
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

  const insuficiente = principal.suficiente === false;

  return (
    <p
      className={cn(
        "text-xs leading-tight",
        insuficiente ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      Renda necessária:{" "}
      <span className="font-semibold text-foreground">{formatBRL(principal.rendaMinima)}</span>{" "}
      <span className="opacity-70">({sistema === "P" ? "PRICE" : "SAC"})</span>
    </p>
  );
}
