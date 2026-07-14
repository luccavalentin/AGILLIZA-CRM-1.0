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

export function ContaStatusBadge({ status }: { status: string }) {
  const cfg = statusMap[status] ?? { tone: "muted" as Tone, label: status };
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
