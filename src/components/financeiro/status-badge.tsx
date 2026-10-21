import { ToneBadge, type Tone } from "@/components/crm/tone-badge";

const statusMap: Record<string, { tone: Tone; label: string }> = {
  paga: { tone: "success", label: "Paga" },
  recebida: { tone: "success", label: "Recebida" },
  aberta: { tone: "info", label: "Aberta" },
  parcial: { tone: "warning", label: "Parcial" },
  atrasada: { tone: "danger", label: "Atrasada" },
  cancelada: { tone: "muted", label: "Cancelada" },
  estornada: { tone: "muted", label: "Estornada" },
};

/**
 * O banco usa "paga" nos dois lados; na conta a receber isso aparece como
 * "Recebida" (QA 20/10: "Paga" em contas a receber).
 */
export function ContaStatusBadge({ status, tipo }: { status: string; tipo?: "pagar" | "receber" }) {
  const base = statusMap[status] ?? { tone: "muted" as Tone, label: status };
  const cfg = tipo === "receber" && status === "paga" ? { ...base, label: "Recebida" } : base;
  return <ToneBadge tone={cfg.tone}>{cfg.label}</ToneBadge>;
}

const comissaoMap: Record<string, { tone: Tone; label: string }> = {
  a_receber: { tone: "info", label: "A receber" },
  recebida: { tone: "success", label: "Recebido" },
  paga_parceiro: { tone: "warning", label: "Pago parceiro" },
  encerrada: { tone: "muted", label: "Encerrado" },
};

export function ComissaoStatusBadge({ status }: { status: string }) {
  const cfg = comissaoMap[status] ?? { tone: "muted" as Tone, label: status };
  return <ToneBadge tone={cfg.tone}>{cfg.label}</ToneBadge>;
}
