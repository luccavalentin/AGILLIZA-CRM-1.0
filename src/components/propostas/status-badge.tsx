import { statusProposta } from "./status";
import { ToneBadge } from "@/components/crm/tone-badge";

/** Status que devem discriminar o banco (ex.: "Crédito em análise · Itaú"). */
const STATUS_COM_BANCO = new Set(["em_analise_credito", "credito_aprovado", "credito_recusado"]);

export function PropostaStatusBadge({ status, banco }: { status: string; banco?: string | null }) {
  const cfg = statusProposta(status);
  const label = banco && STATUS_COM_BANCO.has(status) ? `${cfg.label} · ${banco}` : cfg.label;
  return <ToneBadge tone={cfg.tone}>{label}</ToneBadge>;
}
