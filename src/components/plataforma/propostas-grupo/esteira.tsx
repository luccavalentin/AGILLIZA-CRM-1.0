import { cn } from "@/lib/utils";
import { ESTEIRA_ASSINANTE, etapaDaEsteira } from "./filtros";

/** Mini-esteira da proposta (Fila → … → Contrato registrado), como a do Agilliza Tech. */
export function MiniEsteiraAssinante({ status, className }: { status: string; className?: string }) {
  const atual = etapaDaEsteira(status);
  const parou = status === "cancelada" || status === "recusada";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={
        atual >= 0 ? `Etapa ${atual + 1} de ${ESTEIRA_ASSINANTE.length}: ${ESTEIRA_ASSINANTE[atual].rotulo}` : "Fora da esteira"
      }
      title={atual >= 0 ? ESTEIRA_ASSINANTE[atual].rotulo : undefined}
    >
      {ESTEIRA_ASSINANTE.map((e, i) => (
        <span
          key={e.id}
          className={cn(
            "h-1.5 w-3.5 rounded-full transition-colors",
            parou
              ? "bg-muted-foreground/25"
              : i < atual
                ? "bg-primary/60"
                : i === atual
                  ? "bg-primary"
                  : "bg-muted",
          )}
        />
      ))}
    </span>
  );
}
