export { formatBRL, formatPercent, parseBRL, maskBRLInput } from "@/lib/simulacao/format";

/** Formata data ISO (yyyy-mm-dd) para dd/mm/aaaa. Aceita Date/string/qualquer. */
export function formatData(iso: string | Date | null | undefined | unknown): string {
  if (iso == null || iso === "") return "—";
  const s = String(iso instanceof Date ? "" : iso);
  // Data civil (aaaa-mm-dd): lida como está. Instante (Date ou timestamp com hora):
  // convertido para o dia local — cortar o texto em UTC adianta a data depois das 21h.
  if (iso instanceof Date || s.length > 10) {
    const dt = iso instanceof Date ? iso : new Date(s);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  }
  const [y, m, day] = s.split("-");
  if (!y || !m || !day) return "—";
  return `${day}/${m}/${y}`;
}

/**
 * Soma meses a uma data civil (yyyy-mm-dd) mantendo o dia, ou o último dia do
 * mês quando ele não existe: 31/01 + 1 = 28/02 (29 no bissexto), 31/10 + 1 = 30/11.
 * `Date.setMonth` estoura para o mês seguinte (31/10 + 1 = 01/12).
 */
export function somarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const total = y * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(d, ultimo);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Data de hoje em yyyy-mm-dd no horário de Brasília — igual no navegador e no
 * servidor (que pode rodar em UTC). `toISOString().slice(0, 10)` dá o dia
 * seguinte depois das 21h.
 */
export function hojeISO(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" });
}
