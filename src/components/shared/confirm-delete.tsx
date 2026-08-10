import { useState, type ReactNode } from "react";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDeleteProps {
  /** Executa a exclusão. Deve lançar erro em caso de falha. */
  onConfirm: () => Promise<void>;
  /** Título do diálogo. */
  titulo?: string;
  /** Texto explicativo. */
  descricao?: ReactNode;
  /** Rótulo do botão de confirmação. */
  confirmarLabel?: string;
  /** Gatilho customizado. Se ausente, usa um botão de lixeira. */
  trigger?: ReactNode;
  /** Classe extra no gatilho padrão. */
  className?: string;
}

/** Botão + diálogo de confirmação reutilizável para exclusões. */
export function ConfirmDelete({
  onConfirm,
  titulo = "Confirmar exclusão",
  descricao = "Esta ação não pode ser desfeita.",
  confirmarLabel = "Excluir",
  trigger,
  className,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir"
            className={cn(
              "text-destructive hover:bg-destructive/10 hover:text-destructive",
              className,
            )}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader className="items-center sm:items-start">
          <AlertDialogIcon className="bg-destructive/10 text-destructive ring-destructive/15">
            <Trash2 className="size-6" />
          </AlertDialogIcon>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : confirmarLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
