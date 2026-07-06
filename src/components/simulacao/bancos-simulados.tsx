import { Landmark } from "lucide-react";
import { ToneBadge, type Tone } from "@/components/crm/tone-badge";

export interface BancoResumoChip {
  nome_banco: string | null;
  status_banco: string | null;
}

const TOM_STATUS: Record<string, Tone> = {
  simulada: "success",
  aguardando: "info",
  erro: "danger",
  expirada: "muted",
};

/**
 * Lista, de forma clara, em quais bancos a simulação foi enviada/simulada.
 * Cada banco vira um chip com tom conforme a situação (simulado, aguardando, erro…).
 */
export function BancosSimulados({
  bancos,
  className,
}: {
  bancos: BancoResumoChip[] | null | undefined;
  className?: string;
}) {
  if (!bancos || bancos.length === 0) {
    return <span className="text-xs text-muted-foreground">Nenhum banco</span>;
  }
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {bancos.map((b, i) => (
        <ToneBadge key={`${b.nome_banco}-${i}`} tone={TOM_STATUS[b.status_banco ?? ""] ?? "muted"}>
          <Landmark className="h-3 w-3" />
          {b.nome_banco ?? "—"}
        </ToneBadge>
      ))}
    </div>
  );
}
