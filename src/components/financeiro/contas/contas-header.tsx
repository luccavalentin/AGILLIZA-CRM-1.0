import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { NovaContaDialog } from "@/components/financeiro/nova-conta-dialog";
import { PanelHeader } from "@/components/common/dashboard";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

/**
 * Cabeçalho da página de contas a pagar/receber. Reutiliza o PanelHeader
 * usado no painel e no fluxo de caixa para manter tipografia, hierarquia
 * e chip de status consistentes em todo o módulo Financeiro.
 */
export function ContasHeader({ tipo }: { tipo: ContaTipo }) {
  const recebe = tipo === "receber";
  return (
    <PanelHeader
      eyebrow={recebe ? "Financeiro · Contas a receber" : "Financeiro · Contas a pagar"}
      titulo={recebe ? "Contas a receber" : "Contas a pagar"}
      descricao={
        recebe
          ? "Comissões, taxas e outros recebimentos em aberto."
          : "Fornecedores, parceiros, impostos e despesas."
      }
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            {recebe ? (
              <ArrowDownCircle className="h-3.5 w-3.5 text-success" />
            ) : (
              <ArrowUpCircle className="h-3.5 w-3.5 text-warning" />
            )}
            {recebe ? "Entradas" : "Saídas"}
          </span>
          <NovaContaDialog tipo={tipo} />
        </div>
      }
    />
  );
}
