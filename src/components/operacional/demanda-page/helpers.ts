export function formatarTempoAberto(inicio?: string | null, fim?: string | null): string {
  if (!inicio) return "—";
  const ini = new Date(inicio).getTime();
  const fimTs = fim ? new Date(fim).getTime() : Date.now();
  const diff = Math.max(0, fimTs - ini);
  const dias = Math.floor(diff / (24 * 3600_000));
  const horas = Math.floor((diff % (24 * 3600_000)) / 3600_000);
  if (dias > 0) return `${dias}d ${horas}h`;
  const mins = Math.floor((diff % 3600_000) / 60_000);
  if (horas > 0) return `${horas}h ${mins}m`;
  return `${mins}m`;
}

export const STATUS_PILL_CLS: Record<string, string> = {
  aberta: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25",
  em_andamento: "bg-primary text-primary-foreground",
  aguardando: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30",
  concluida: "bg-success/15 text-success ring-1 ring-inset ring-success/30",
  cancelada: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};
