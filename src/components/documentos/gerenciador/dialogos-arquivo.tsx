import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ArquivoNo } from "@/lib/documentos/arquivos.functions";

/** Diálogo de criação de pasta na localização atual. */
export function NovaPastaDialog({
  open,
  onOpenChange,
  onCriar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar: (nome: string) => void;
}) {
  const [nome, setNome] = useState("");
  useEffect(() => {
    if (open) setNome("");
  }, [open]);

  const confirmar = () => {
    const limpo = nome.trim();
    if (limpo) onCriar(limpo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
          <DialogDescription>Crie uma pasta na localização atual.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da pasta"
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo de renomeação de um nó. */
export function RenomearDialog({
  no,
  onClose,
  onConfirmar,
}: {
  no: ArquivoNo | null;
  onClose: () => void;
  onConfirmar: (nome: string) => void;
}) {
  const [nome, setNome] = useState("");
  useEffect(() => {
    if (no) setNome(no.nome);
  }, [no]);

  const confirmar = () => {
    const limpo = nome.trim();
    if (limpo) onConfirmar(limpo);
  };

  return (
    <Dialog open={!!no} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de exclusão (pasta recursiva ou arquivo). */
export function ExcluirDialog({
  no,
  onClose,
  onConfirmar,
}: {
  no: ArquivoNo | null;
  onClose: () => void;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog open={!!no} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir {no?.tipo === "pasta" ? "pasta" : "arquivo"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {no?.tipo === "pasta"
              ? "A pasta e todo o seu conteúdo serão removidos permanentemente."
              : "O arquivo será removido permanentemente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
