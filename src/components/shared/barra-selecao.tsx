import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra de ações em massa exibida quando o usuário seleciona linhas
 * (simulações/propostas). Fica fixa no rodapé para não empurrar o conteúdo.
 */
export function BarraSelecao({
  quantidade,
  onLimpar,
  onExcluir,
  excluindo,
  rotulo = "registro(s)",
}: {
  quantidade: number;
  onLimpar: () => void;
  onExcluir: () => void;
  excluindo?: boolean;
  rotulo?: string;
}) {
  if (quantidade === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {quantidade} {rotulo}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 rounded-lg"
          onClick={onExcluir}
          disabled={excluindo}
        >
          {excluindo ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Trash2 className="mr-1.5 size-3.5" />
          )}
          Excluir selecionados
        </Button>
        <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={onLimpar}>
          <X className="mr-1 size-3.5" /> Limpar
        </Button>
      </div>
    </div>
  );
}
