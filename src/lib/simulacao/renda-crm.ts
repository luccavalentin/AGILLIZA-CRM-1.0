/**
 * Renda do CRM na simulação (módulo puro).
 *
 * Regra: a renda do cadastro (titular + cônjuge com renda) só é mantida na
 * simulação quando cobre a renda necessária de todas as tabelas simuladas
 * (SAC e/ou PRICE). Se não cobre, o usuário digita a renda desta simulação —
 * e é essa renda que vai ao banco. Em ambos os casos o campo segue editável.
 */
import { avaliarRendaMinima } from "./renda";

export interface DecisaoRendaCrm {
  /** Titular + cônjuge (quando tem renda) conforme o CRM. */
  rendaCrm: number;
  rendaTitularCrm: number;
  rendaConjugeCrm: number;
  necessariaSac: number | null;
  necessariaPrice: number | null;
  /** Maior renda exigida entre as tabelas simuladas. */
  necessaria: number;
  suficiente: boolean;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function decidirRendaDoCrm(params: {
  rendaTitularCrm: unknown;
  rendaConjugeCrm: unknown;
  /** Só soma o cônjuge quando o titular é casado/união estável. */
  temConjuge: boolean;
  valor_financiamento: number;
  valor_imovel?: number | null;
  prazo: number;
  taxa_ano: number;
  /** "S" SAC, "P" PRICE, "B" ambos. */
  sistema: string;
}): DecisaoRendaCrm | null {
  const rendaTitularCrm = num(params.rendaTitularCrm);
  const rendaConjugeCrm = params.temConjuge ? num(params.rendaConjugeCrm) : 0;
  const rendaCrm = rendaTitularCrm + rendaConjugeCrm;
  if (rendaCrm <= 0) return null;

  const avaliar = (sistema: "S" | "P") =>
    avaliarRendaMinima({
      valor_financiamento: Number(params.valor_financiamento) || 0,
      valor_imovel: params.valor_imovel,
      prazo_meses: Number(params.prazo) || 0,
      taxa_ano: params.taxa_ano,
      sistema,
    })?.rendaMinima ?? null;

  const usaSac = params.sistema !== "P";
  const usaPrice = params.sistema === "P" || params.sistema === "B";
  const necessariaSac = usaSac ? avaliar("S") : null;
  const necessariaPrice = usaPrice ? avaliar("P") : null;
  // Sem financiamento/prazo ainda não há o que comparar.
  if ((usaSac && necessariaSac == null) || (usaPrice && necessariaPrice == null)) return null;

  const necessaria = Math.max(necessariaSac ?? 0, necessariaPrice ?? 0);
  return {
    rendaCrm,
    rendaTitularCrm,
    rendaConjugeCrm,
    necessariaSac,
    necessariaPrice,
    necessaria,
    suficiente: rendaCrm >= necessaria,
  };
}
