import { cn } from "@/lib/utils";
import type { StatusFuncionario } from "@/lib/rh/funcionarios.functions";
import { STATUS_FUNCIONARIO_LABEL } from "@/lib/rh/rotulos";

const map: Record<StatusFuncionario, { label: string; cls: string }> = {
  ativo: {
    label: STATUS_FUNCIONARIO_LABEL.ativo,
    cls: "bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-success",
  },
  experiencia: {
    label: STATUS_FUNCIONARIO_LABEL.experiencia,
    cls: "bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] text-warning-foreground",
  },
  afastado: {
    label: STATUS_FUNCIONARIO_LABEL.afastado,
    cls: "bg-muted text-muted-foreground",
  },
  ferias: {
    label: STATUS_FUNCIONARIO_LABEL.ferias,
    cls: "bg-primary/10 text-primary",
  },
  desligado: {
    label: STATUS_FUNCIONARIO_LABEL.desligado,
    cls: "bg-destructive/10 text-destructive",
  },
};

export function StatusFuncionarioBadge({ status }: { status: StatusFuncionario }) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}
