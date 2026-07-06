import { Landmark } from "lucide-react";
import { ToneBadge, type Tone } from "@/components/crm/tone-badge";

export interface BancoPropostaChip {
  nome_banco: string | null;
  status_banco: string | null;
}

const TOM_STATUS: Record<string, Tone> = {
  aguardando: "info",
  nao_enviado: "muted",
  enviada: "info",
  em_analise: "info",
  condicionado: "warning",
  aprovado: "success",
  recusado: "danger",
  cancelado: "muted",
};

/**
 * Mostra, de forma clara, em quais bancos a proposta foi enviada e a situação em cada um.
 */
export function BancosProposta({
  bancos,
  className,
}: {
  bancos: BancoPropostaChip[] | null | undefined;
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
