import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

/**
 * Menu de ações de uma conta (a pagar/receber). Extraído de `contas-page.tsx`
 * para permitir reuso entre a tabela (desktop) e os cartões (mobile) sem
 * duplicar as regras de exibição por status.
 */
export function AcoesMenu({
  conta,
  tipo,
  onDetalhe,
  onBaixar,
  onEstornar,
  onCancelar,
  onExcluir,
}: {
  conta: any;
  tipo: ContaTipo;
  onDetalhe: () => void;
  onBaixar: () => void;
  onEstornar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da conta">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDetalhe}>Ver detalhes</DropdownMenuItem>
        {conta.status !== "paga" &&
          conta.status !== "cancelada" &&
          conta.status !== "estornada" && (
            <DropdownMenuItem onClick={onBaixar}>
              {tipo === "pagar" ? "Baixar" : "Confirmar recebimento"}
            </DropdownMenuItem>
          )}
        {conta.status !== "estornada" && conta.valor_pago > 0 && (
          <DropdownMenuItem className="text-destructive" onClick={onEstornar}>
            Estornar
          </DropdownMenuItem>
        )}
        {conta.status !== "cancelada" && conta.status !== "estornada" && (
          <DropdownMenuItem className="text-destructive" onClick={onCancelar}>
            Cancelar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={onExcluir}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
