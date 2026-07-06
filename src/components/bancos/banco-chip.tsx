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
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: cor,
        borderColor: `${cor}33`,
        backgroundColor: `${cor}14`,
      }}
    >
      <BancoLogo nome={nome} size="xs" />
      {nome ?? "—"}
    </span>
  );
}
