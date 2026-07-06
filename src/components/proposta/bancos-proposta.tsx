import { BancoChip } from "@/components/bancos/banco-chip";

export interface BancoPropostaChip {
  nome_banco: string | null;
  status_banco: string | null;
}

/**
 * Mostra, de forma clara, em quais bancos a proposta foi enviada.
 * Cada banco aparece na cor da própria marca do banco.
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
        <BancoChip key={`${b.nome_banco}-${i}`} nome={b.nome_banco} />
      ))}
    </div>
  );
}
