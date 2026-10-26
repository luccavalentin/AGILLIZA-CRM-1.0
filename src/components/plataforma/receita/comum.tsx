/**
 * Peças comuns das telas financeiras da Gestão de sistemas (Receita, Comissões, Planos):
 * trilho de abas com contagem e o valor monetário com centavos discretos.
 */
import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";

/** Trilho de abas do padrão: cinza, a escolhida em branco, rola dentro dele no celular. */
export function TrilhoAbas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      <TabsList
        className={cn("h-auto min-w-max justify-start gap-0.5 rounded-[10px] bg-secondary p-1", className)}
      >
        {children}
      </TabsList>
    </div>
  );
}

export function AbaComContagem({
  value,
  rotulo,
  contagem,
  alerta,
  icone,
}: {
  value: string;
  rotulo: string;
  contagem?: number | null;
  /** Contagem em vermelho (algo pede atenção). */
  alerta?: boolean;
  icone?: ReactNode;
}) {
  return (
    <TabsTrigger value={value} className="min-h-11 gap-1.5 rounded-md px-3 sm:min-h-8 [&_svg]:size-4">
      {icone}
      {rotulo}
      {contagem != null && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] tabular-nums",
            alerta && contagem > 0 ? "bg-destructive/10 text-destructive" : "bg-foreground/[0.06] text-muted-foreground",
          )}
        >
          {contagem.toLocaleString("pt-BR")}
        </span>
      )}
    </TabsTrigger>
  );
}

/** "R$ 1.234" grande com ",56" discreto: leitura rápida em indicador e linha de valor. */
export function Dinheiro({ valor, className }: { valor: number | null | undefined; className?: string }) {
  const txt = formatBRL(Number(valor ?? 0));
  const i = txt.lastIndexOf(",");
  if (i < 0) return <span className={cn("tabular-nums", className)}>{txt}</span>;
  return (
    <span className={cn("tabular-nums", className)}>
      {txt.slice(0, i)}
      <span className="text-[0.72em] text-muted-foreground">{txt.slice(i)}</span>
    </span>
  );
}

export const TIPO_CONTA: Record<string, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
  particular: "Particular",
  patrocinador: "Patrocinador",
  todos: "Todos",
};
