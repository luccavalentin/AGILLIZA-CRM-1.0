import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";
import { usePermissoesConta } from "./use-permissoes-conta";

/**
 * Menu de ações de uma conta (a pagar/receber). Extraído de `contas-page.tsx`
 * para permitir reuso entre a tabela (desktop) e os cartões (mobile) sem
 * duplicar as regras de exibição por status.
 */
export function AcoesMenu({
  conta,
  tipo,
  onDetalhe,
  onEditar,
  onBaixar,
  onEstornar,
  onCancelar,
  onExcluir,
}: {
  conta: any;
  tipo: ContaTipo;
  onDetalhe: () => void;
  onEditar: () => void;
  onBaixar: () => void;
  onEstornar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
}) {
  // Cada item segue a permissão que o servidor exige (baixar/estornar = baixar;
  // editar/cancelar/excluir = editar).
  const pode = usePermissoesConta(tipo);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da conta">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDetalhe}>Ver detalhes</DropdownMenuItem>
        {pode.editar && <DropdownMenuItem onClick={onEditar}>Editar</DropdownMenuItem>}
        {pode.baixar &&
          conta.status !== "paga" &&
          conta.status !== "cancelada" &&
          conta.status !== "estornada" && (
            <DropdownMenuItem onClick={onBaixar}>
              {tipo === "pagar" ? "Baixar" : "Confirmar recebimento"}
            </DropdownMenuItem>
          )}
        {pode.baixar && conta.status !== "estornada" && conta.valor_pago > 0 && (
          <DropdownMenuItem className="text-destructive" onClick={onEstornar}>
            Estornar
          </DropdownMenuItem>
        )}
        {/* Conta com pagamento não cancela (o servidor recusa: estorne antes) —
            o item aparecia e sempre dava erro (QA 20/10). */}
        {pode.editar &&
          conta.status !== "cancelada" &&
          conta.status !== "estornada" &&
          !(Number(conta.valor_pago) > 0) && (
            <DropdownMenuItem className="text-destructive" onClick={onCancelar}>
              Cancelar conta
            </DropdownMenuItem>
          )}
        {pode.editar && (
          <DropdownMenuItem className="text-destructive" onClick={onExcluir}>
            Excluir conta
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
