/**
 * Conversão de valores em reais digitados nos formulários do RH.
 *
 * Aceita número (vindo do banco) e texto em pt-BR ou com ponto decimal:
 * 2500.75, "2500.75", "2500,75", "2.500,75", "R$ 2.500,75", "2.500".
 * Ponto seguido de exatamente 3 dígitos é tratado como separador de milhar.
 */
export function parseMoeda(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).replace(/[^0-9.,-]/g, "");
  if (!s) return 0;
  const negativo = s.startsWith("-");
  s = s.replace(/-/g, "");
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimaVirgula > ultimoPonto) {
    // Vírgula decimal: pontos são milhar.
    const inteiro = s.slice(0, ultimaVirgula).replace(/[.,]/g, "");
    s = `${inteiro}.${s.slice(ultimaVirgula + 1)}`;
  } else if (ultimoPonto >= 0) {
    const pontos = s.split(".").length - 1;
    const casas = s.length - ultimoPonto - 1;
    s = s.replace(/,/g, "");
    if (pontos > 1 || casas === 3) {
      // "1.234.567" ou "2.500": milhar.
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
}

/** Valor do banco para o campo de texto do formulário ("2.500,75"). */
export function formatarMoedaInput(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = parseMoeda(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
