import { useQuery } from "@tanstack/react-query";
import { Folder, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArquivoNo, PastaFlat } from "@/lib/documentos/arquivos.functions";

export interface MoverDialogProps {
  no: ArquivoNo | null;
  onClose: () => void;
  carregarPastas: () => Promise<PastaFlat[]>;
  onMover: (destino: string | null) => void;
}

/** Diálogo de seleção de pasta de destino para mover um nó. */
export function MoverDialog({ no, onClose, carregarPastas, onMover }: MoverDialogProps) {
  const pastas = useQuery({
    queryKey: ["arquivos-pastas-mover"],
    queryFn: carregarPastas,
    enabled: !!no,
  });

  return (
    <Dialog open={!!no} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover "{no?.nome}"</DialogTitle>
          <DialogDescription>Escolha a pasta de destino.</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-auto">
          <button
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => onMover(null)}
          >
            <Home className="h-4 w-4 text-muted-foreground" /> Início (raiz)
          </button>
          {(pastas.data ?? [])
            .filter((p) => p.id !== no?.id)
            .map((p) => (
              <button
                key={p.id}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onMover(p.id)}
              >
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{p.caminho}</span>
              </button>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
