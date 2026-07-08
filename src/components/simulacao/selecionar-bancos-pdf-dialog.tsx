import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL } from "@/lib/simulacao/format";
import { baixarSimulacaoPDF } from "@/lib/simulacao/simulacao-pdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulacao: any;
  bancos: any[];
}

/** Deixa o usuário escolher quais bancos entram no PDF comparativo consolidado. */
export function SelecionarBancosPdfDialog({ open, onOpenChange, simulacao, bancos }: Props) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});

  // Ao abrir, começa com todos os bancos marcados.
  useEffect(() => {
    if (open) {
      const inicial: Record<string, boolean> = {};
      (bancos ?? []).forEach((b, i) => {
        inicial[b.id ?? String(i)] = true;
      });
      setSelecionados(inicial);
    }
  }, [open, bancos]);

  const escolhidos = useMemo(
    () => (bancos ?? []).filter((b, i) => selecionados[b.id ?? String(i)]),
    [bancos, selecionados],
  );

  const todosMarcados = (bancos ?? []).length > 0 && escolhidos.length === (bancos ?? []).length;

  function alternarTodos() {
    const novo: Record<string, boolean> = {};
    (bancos ?? []).forEach((b, i) => {
      novo[b.id ?? String(i)] = !todosMarcados;
    });
    setSelecionados(novo);
  }

  async function gerar() {
    const { baixarSimulacaoPDF } = await import("@/lib/simulacao/simulacao-pdf");
    baixarSimulacaoPDF({ simulacao, bancos: escolhidos });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Comparativo consolidado</DialogTitle>
          <DialogDescription>
            Selecione os bancos que devem aparecer no PDF comparativo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2">
            <Checkbox checked={todosMarcados} onCheckedChange={alternarTodos} />
            <span className="text-sm font-medium text-foreground">Selecionar todos</span>
          </label>
          {(bancos ?? []).map((b, i) => {
            const key = b.id ?? String(i);
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={!!selecionados[key]}
                  onCheckedChange={(v) =>
                    setSelecionados((prev) => ({ ...prev, [key]: !!v }))
                  }
                />
                <span className="flex-1 text-sm text-foreground">{b.nome_banco ?? "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {b.valor_parcela != null ? formatBRL(b.valor_parcela) : "—"}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={escolhidos.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Gerar PDF ({escolhidos.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
