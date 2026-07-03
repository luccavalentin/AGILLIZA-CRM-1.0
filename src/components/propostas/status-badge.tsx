import { statusProposta } from "./status";
import { ToneBadge } from "@/components/crm/tone-badge";

export function PropostaStatusBadge({ status }: { status: string }) {
  const cfg = statusProposta(status);
  return <ToneBadge tone={cfg.tone}>{cfg.label}</ToneBadge>;
}
