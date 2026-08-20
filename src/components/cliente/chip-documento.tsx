import { cn } from "@/lib/utils";

type ToneDoc = "pendente" | "recebido" | "aprovado" | "reprovado" | "expirado";

const MAPA: Record<string, { label: string; classe: string }> = {
  pendente: { label: "Aguardando envio", classe: "bg-warning/15 text-warning border-warning/30" },
  recebido: { label: "Em análise", classe: "bg-primary/15 text-primary border-primary/30" },
  aprovado: { label: "Aprovado", classe: "bg-success/15 text-success border-success/30" },
  reprovado: {
    label: "Reenviar",
    classe: "bg-destructive/15 text-destructive border-destructive/30",
  },
  expirado: {
    label: "Expirado",
    classe: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export function ChipDocumento({ status }: { status: string }) {
  const cfg = MAPA[status as ToneDoc] ?? MAPA.pendente;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.classe,
      )}
    >
      {cfg.label}
    </span>
  );
}
