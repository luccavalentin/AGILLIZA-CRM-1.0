export { formatBRL, formatPercent, parseBRL, maskBRLInput } from "@/lib/simulacao/format";

/** Formata data ISO (yyyy-mm-dd) para dd/mm/aaaa. */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length > 10 ? iso.slice(0, 10) : iso;
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
