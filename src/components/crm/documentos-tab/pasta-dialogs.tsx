import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentoPasta } from "@/lib/crm/documento-pastas.functions";

export function NovaPastaDialog({
  open,
  onOpenChange,
  nome,
  setNome,
  onConfirmar,
  salvando,
  titulo = "Nova pasta",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nome: string;
  setNome: (v: string) => void;
  onConfirmar: () => void;
  salvando: boolean;
  titulo?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nome da pasta</label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirmar()}
            placeholder="Ex.: Certidões, Comprovantes…"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar} disabled={salvando}>
            {salvando ? "Criando…" : "Criar pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenomearPastaDialog({
  alvo,
  onClose,
  nome,
  setNome,
  onConfirmar,
  salvando,
}: {
  alvo: DocumentoPasta | null;
  onClose: () => void;
  nome: string;
  setNome: (v: string) => void;
  onConfirmar: () => void;
  salvando: boolean;
}) {
  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear pasta</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nome da pasta</label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirmar()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirPastaDialog({
  alvo,
  onClose,
  onConfirmar,
  excluindo,
  descricaoExtra,
}: {
  alvo: DocumentoPasta | null;
  onClose: () => void;
  onConfirmar: () => void;
  excluindo: boolean;
  descricaoExtra?: string;
}) {
  return (
    <AlertDialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
          <AlertDialogDescription>
            A pasta "{alvo?.nome}"
            {descricaoExtra ? ` ${descricaoExtra}` : ""} será removida. Os documentos
            dentro dela serão movidos para "Outros". Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirmar();
            }}
            disabled={excluindo}
          >
            {excluindo ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
