import { cn } from "@/lib/utils";

/** Tons semânticos oficiais (00b-tons-cores). */
export type Tone = "success" | "info" | "warning" | "danger" | "muted";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/10 text-success border border-success/20",
  info: "bg-primary/10 text-primary border border-primary/20",
  warning: "bg-warning/15 text-warning-foreground border border-warning/30",
  danger: "bg-destructive/10 text-destructive border border-destructive/20",
  muted: "bg-muted text-muted-foreground border border-border",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Mapa oficial status -> tom + rótulo. */
const statusMap: Record<string, { tone: Tone; label: string }> = {
  ativo: { tone: "success", label: "Ativo" },
  contratado: { tone: "success", label: "Contratado" },
  em_analise: { tone: "info", label: "Em análise" },
  em_simulacao: { tone: "info", label: "Em simulação" },
  novo: { tone: "info", label: "Novo" },
  pendente_documentos: { tone: "warning", label: "Pendente docs" },
  aguardando_cliente: { tone: "warning", label: "Aguardando cliente" },
  bloqueado: { tone: "danger", label: "Bloqueado" },
  desistiu: { tone: "danger", label: "Desistiu" },
  recusado: { tone: "danger", label: "Recusado" },
  rascunho: { tone: "muted", label: "Rascunho" },
  arquivado: { tone: "muted", label: "Arquivado" },
  inativo: { tone: "muted", label: "Inativo" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusMap[status] ?? { tone: "muted" as Tone, label: status };
  return <ToneBadge tone={cfg.tone}>{cfg.label}</ToneBadge>;
}

export function PortalBadge({ ativo }: { ativo: boolean }) {
  return (
    <ToneBadge tone={ativo ? "success" : "muted"}>
      {ativo ? "Portal ativo" : "Sem portal"}
    </ToneBadge>
  );
}
