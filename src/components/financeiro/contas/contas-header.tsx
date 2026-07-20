import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { NovaContaDialog } from "@/components/financeiro/nova-conta-dialog";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

/**
 * Cabeçalho (hero) da página de contas a pagar/receber. Isolado para
 * manter a página principal enxuta e permitir ajustar hierarquia visual
 * de forma centralizada.
 */
export function ContasHeader({ tipo }: { tipo: ContaTipo }) {
  const recebe = tipo === "receber";
  const titulo = recebe ? "Contas a receber" : "Contas a pagar";
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {recebe ? <ArrowDownCircle className="h-6 w-6" /> : <ArrowUpCircle className="h-6 w-6" />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {titulo}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tipo === "pagar"
              ? "Fornecedores, parceiros, impostos e despesas."
              : "Comissões, taxas e outros recebimentos."}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <NovaContaDialog tipo={tipo} />
      </div>
    </div>
  );
}
