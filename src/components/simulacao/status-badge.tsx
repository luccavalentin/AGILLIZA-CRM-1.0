import { ToneBadge, type Tone } from "@/components/crm/tone-badge";

const MAPA: Record<string, { tone: Tone; label: string }> = {
  rascunho: { tone: "muted", label: "Rascunho" },
  enviando: { tone: "info", label: "Enviando…" },
  simulada: { tone: "success", label: "Simulação" },
  parcialmente_simulada: { tone: "warning", label: "Parcial" },
  erro_banco: { tone: "danger", label: "Erro no banco" },
  expirada: { tone: "muted", label: "Expirada" },
  cancelada: { tone: "muted", label: "Cancelada" },
  promovida: { tone: "success", label: "Promovida" },
};

export function SimulacaoStatusBadge({ status }: { status: string }) {
  const cfg = MAPA[status] ?? { tone: "muted" as Tone, label: status };
  return (
    <ToneBadge
      tone={cfg.tone}
      className="whitespace-nowrap px-2 py-0.5 h-auto text-[11px] font-bold"
    >
      {cfg.label}
    </ToneBadge>
  );
}

const BANCO_MAPA: Record<string, { tone: Tone; label: string }> = {
  aguardando: { tone: "info", label: "Aguardando" },
  simulada: { tone: "success", label: "Simulação" },
  erro: { tone: "danger", label: "Erro" },
  expirada: { tone: "muted", label: "Expirada" },
};

export function BancoStatusBadge({
  status,
  hasId = true,
}: {
  status: string;
  hasId?: boolean;
}) {
  let cfg = BANCO_MAPA[status] ?? { tone: "muted" as Tone, label: status };

  // Status Honesto: Se o status é 'aguardando' mas não temos o ID da HomeFin,
  // significa que o sistema ainda nem disparou o envio, não que o banco está analisando.
  if (status === "aguardando" && !hasId) {
    cfg = { tone: "warning", label: "Aguardando envio" };
  } else if (status === "aguardando" && hasId) {
    cfg = { tone: "info", label: "Em análise" };
  }

  return (
    <ToneBadge
      tone={cfg.tone}
      className="whitespace-nowrap px-1.5 py-0.5 h-auto text-[11px] font-bold"
    >
      {cfg.label}
    </ToneBadge>
  );
}
