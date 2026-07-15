import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getResumoParceiro } from "@/lib/parceiro/portal.functions";

interface Props {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}

/** Cabeçalho padrão do Portal do Parceiro com o selo de escopo restrito. */
export function ParceiroPage({ titulo, descricao, acoes, children }: Props) {
  const resumo = useQuery({
    queryKey: ["parceiro-resumo"],
    queryFn: () => getResumoParceiro(),
  });

  const selo =
    resumo.data?.razao_social ??
    resumo.data?.nome ??
    (resumo.data?.papel === "imobiliaria" ? "Imobiliária" : "Corretor");

  return (
    <div className="mx-auto w-full max-w-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{titulo}</h1>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resumo.data && (
            <span className="max-w-full truncate rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {selo}
            </span>
          )}
          {acoes}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function formatBRL(valor: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor ?? 0));
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
