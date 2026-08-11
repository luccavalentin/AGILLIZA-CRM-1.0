import { cn } from "@/lib/utils";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";

/**
 * Chip que exibe o nome do banco na cor da sua marca.
 * Usado em qualquer lugar onde há referência a um banco.
 */
export function BancoChip({
  nome,
  className,
}: {
  nome: string | null | undefined;
  className?: string;
}) {
  const cor = corDoBanco(nome);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap shadow-sm",
        className,
      )}
      style={{
        color: cor,
        borderColor: `${cor}40`,
        backgroundColor: `${cor}18`,
      }}
    >
      <BancoLogo nome={nome} size="xs" />
      {nome ?? "—"}
    </span>
  );
}
