export { formatBRL, formatPercent, parseBRL, maskBRLInput } from "@/lib/simulacao/format";

/** Formata data ISO (yyyy-mm-dd) para dd/mm/aaaa. Aceita Date/string/qualquer. */
export function formatData(iso: string | Date | null | undefined | unknown): string {
  if (iso == null || iso === "") return "—";
  let s: string;
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return "—";
    s = iso.toISOString().slice(0, 10);
  } else {
    s = String(iso);
  }
  const d = s.length > 10 ? s.slice(0, 10) : s;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "—";
  return `${day}/${m}/${y}`;
}


/** Data de hoje em yyyy-mm-dd (horário local). */
export function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
