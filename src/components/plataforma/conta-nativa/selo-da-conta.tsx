import { Building2 } from "lucide-react";

/** Selo discreto da conta (licença) de origem numa linha da base de um assinante. */
export function SeloDaConta({ conta }: { conta: string }) {
  return (
    <span
      className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/60"
      title={`Gerada na conta ${conta}`}
    >
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{conta}</span>
    </span>
  );
}
