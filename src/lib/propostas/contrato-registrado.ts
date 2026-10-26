/**
 * "Marcar contrato registrado" (pedido do dono de 26/10/2026, C12) — regras puras, usadas na tela
 * e revalidadas no servidor (`marcarContratoRegistrado`).
 *
 * A data é a do cartório, escolhida pelo analista: não pode ser futura nem anterior à emissão do
 * contrato. Grava-se meio-dia de São Paulo (sem horário de verão desde 2019: UTC-3), para que a
 * data não "escorregue" para o dia anterior/seguinte em nenhum fuso.
 */

/** "Hoje" em São Paulo, no formato AAAA-MM-DD. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Data (AAAA-MM-DD) de um instante, no calendário de São Paulo. */
export function dataEmSaoPaulo(instante: string | Date | null | undefined): string | null {
  if (!instante) return null;
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return (
    dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && a >= 2000
  );
}

/** Erro legível, ou `null` quando a data pode ser gravada. */
export function erroDataRegistro(
  data: string | null | undefined,
  contratoEmitidoEm: string | null | undefined,
  agora: Date = new Date(),
): string | null {
  const v = (data ?? "").trim();
  if (!v) return "Informe a data do registro.";
  if (!dataValida(v)) return "Data do registro inválida.";
  if (v > hojeEmSaoPaulo(agora)) return "A data do registro não pode ser futura.";
  const emissao = dataEmSaoPaulo(contratoEmitidoEm ?? null);
  if (emissao && v < emissao) {
    const [a, m, d] = emissao.split("-");
    return `O registro não pode ser anterior à emissão do contrato (${d}/${m}/${a}).`;
  }
  return null;
}

/** Instante gravado para a data escolhida: meio-dia em São Paulo. */
export function instanteDoRegistro(data: string): string {
  return new Date(`${data}T12:00:00-03:00`).toISOString();
}

/** "dd/mm/aaaa" da data do registro, no calendário de São Paulo. */
export function formatarDataRegistro(instante: string | null | undefined): string | null {
  const d = dataEmSaoPaulo(instante ?? null);
  if (!d) return null;
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}
