import { REGIMES } from "@/components/crm/cliente-form/constants";

/** Regime de casamento assumido quando o casado(a) não informa: comunhão parcial. */
export const REGIME_PADRAO = "comunhao_parcial";

/** Código da integração (CP/CU/PA/SC/SO) → valor do `Select` do formulário. */
const CODIGO_PARA_FORM: Record<string, string> = {
  CP: "comunhao_parcial",
  CU: "comunhao_universal",
  PA: "participacao_final",
  SC: "separacao_total",
  SO: "separacao_total",
};

/**
 * Regime de casamento no formato que o `Select` da simulação usa (valores de
 * `REGIMES`, os mesmos do cadastro). O cadastro e a simulação salva chegavam
 * ao formulário já convertidos para o código da integração ("CP"), que não
 * casa com nenhuma opção — o campo aparecia vazio mesmo com o regime gravado.
 * Casado(a) sem regime recebe o padrão.
 */
export function regimeParaFormulario(v: unknown, casado: boolean): string {
  const s = String(v ?? "").trim();
  if (REGIMES.some((r) => r.v === s)) return s;
  const doCodigo = CODIGO_PARA_FORM[s.toUpperCase()];
  if (doCodigo) return doCodigo;
  return casado ? REGIME_PADRAO : "";
}
