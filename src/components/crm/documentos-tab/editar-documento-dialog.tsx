import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TIPO_OUTRO } from "@/lib/crm/documento-tipos";
import { CATEGORIA_LABEL, type Categoria } from "./types";

export function EditarDocumentoDialog({
  doc,
  onClose,
  categoriasPasta,
  editCategoria,
  setEditCategoria,
  editTipo,
  setEditTipo,
  editTipoOutro,
  setEditTipoOutro,
  tiposEditCategoria,
  onSalvar,
  salvando,
}: {
  doc: any | null;
  onClose: () => void;
  categoriasPasta: Categoria[];
  editCategoria: Categoria;
  setEditCategoria: (c: Categoria) => void;
  editTipo: string;
  setEditTipo: (t: string) => void;
  editTipoOutro: boolean;
  setEditTipoOutro: (v: boolean) => void;
  tiposEditCategoria: string[];
  onSalvar: () => void;
  salvando: boolean;
}) {
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {categoriasPasta.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Titular do documento</label>
              <Select value={editCategoria} onValueChange={(v) => setEditCategoria(v as Categoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasPasta.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo de documento</label>
            <Select
              value={
                tiposEditCategoria.includes(editTipo) || editTipo === "" ? editTipo : TIPO_OUTRO
              }
              onValueChange={(v) => {
                if (v === TIPO_OUTRO) {
                  setEditTipoOutro(true);
                  setEditTipo("");
                } else {
                  setEditTipoOutro(false);
                  setEditTipo(v);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposEditCategoria.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
                <SelectItem value={TIPO_OUTRO}>Outro (especificar)…</SelectItem>
              </SelectContent>
            </Select>
            {(editTipoOutro ||
              (editTipo !== "" && !tiposEditCategoria.includes(editTipo)) ||
              tiposEditCategoria.length === 0) && (
              <Input
                className="mt-1.5"
                placeholder="Descreva o tipo do documento"
                value={editTipo}
                onChange={(e) => setEditTipo(e.target.value)}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirDocumentoDialog({
  doc,
  onClose,
  onConfirmar,
  excluindo,
}: {
  doc: any | null;
  onClose: () => void;
  onConfirmar: () => void;
  excluindo: boolean;
}) {
  return (
    <AlertDialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
          <AlertDialogDescription>
            O arquivo "{doc?.nome_arquivo}" será removido permanentemente. Esta ação não pode ser
            desfeita.
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
