import { BancoChip } from "@/components/bancos/banco-chip";

export interface BancoResumoChip {
  nome_banco: string | null;
  status_banco: string | null;
}

/**
 * Lista, de forma clara, em quais bancos a simulação foi enviada/simulada.
 * Cada banco vira um chip exibido na cor da própria marca do banco.
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
        <BancoChip key={`${b.nome_banco}-${i}`} nome={b.nome_banco} />
      ))}
    </div>
  );
}
