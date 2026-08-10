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

export function BancoStatusBadge({ status }: { status: string }) {
  const cfg = BANCO_MAPA[status] ?? { tone: "muted" as Tone, label: status };
  return (
    <ToneBadge 
      tone={cfg.tone} 
      className="whitespace-nowrap px-1.5 py-0.5 h-auto text-[11px] font-bold"
    >
      {cfg.label}
    </ToneBadge>
  );
}
