import { Link2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cônjuge da simulação, exibido sob o nome do titular.
 *
 * A hierarquia é tipográfica, não mais uma caixa: "CÔNJUGE" é um micro-rótulo
 * em caixa alta e baixo contraste, e o nome vem em peso médio e cor mais forte.
 * Assim ele se distingue da linha do responsável logo abaixo — que é um usuário
 * interno, não uma pessoa da operação — sem competir com o crachá acima.
 *
 * Na testagem de casal esse cônjuge É o titular da simulação irmã, então o nome
 * vira um atalho para ela: dá para pular direto à comparação em vez de caçar a
 * outra linha na lista.
 */
export function ConjugeDaLinha({
  nome,
  irmaId,
  onAbrirIrma,
  className,
}: {
  nome: string;
  irmaId?: string | null;
  onAbrirIrma?: (id: string) => void;
  className?: string;
}) {
  const navegavel = Boolean(irmaId && onAbrirIrma);

  const conteudo = (
    <>
      {/* O ícone carrega o significado: escrever "CÔNJUGE" por extenso comia
          ~50px da coluna e cortava justamente o nome, que é o que importa.
          O rótulo vive no `title` de quem envolve este conteúdo. */}
      <Link2 className="h-3 w-3 shrink-0 text-primary/60" aria-label="Cônjuge" />
      <span
        className={cn(
          // Preto cheio: o cônjuge é parte da operação, não metadado. O
          // contraste com o micro-rótulo acima é que mantém a hierarquia.
          "truncate text-[11.5px] font-semibold text-foreground",
          navegavel && "group-hover/conj:text-primary group-hover/conj:underline",
        )}
        title={nome}
      >
        {nome}
      </span>
      {navegavel && (
        <ArrowUpRight className="h-3 w-3 shrink-0 text-primary/0 transition-colors group-hover/conj:text-primary" />
      )}
    </>
  );

  if (!navegavel) {
    return (
      <span
        title={`Cônjuge: ${nome}`}
        className={cn("mt-1 flex items-center gap-1.5 leading-none", className)}
      >
        {conteudo}
      </span>
    );
  }

  return (
    <button
      type="button"
      // A linha inteira abre a própria simulação; sem isto o clique aqui
      // abriria a errada.
      onClick={(e) => {
        e.stopPropagation();
        onAbrirIrma!(irmaId!);
      }}
      title={`Cônjuge: ${nome} — abrir a simulação dele(a)`}
      className={cn(
        "group/conj mt-1 flex max-w-full items-center gap-1.5 rounded leading-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      {conteudo}
    </button>
  );
}
