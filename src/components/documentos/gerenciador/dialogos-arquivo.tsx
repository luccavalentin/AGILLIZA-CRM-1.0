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
import type { ResolucaoConflito } from "@/lib/documentos/arquivos-regras";

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
          <DialogDescription>A pasta nasce dentro da pasta aberta.</DialogDescription>
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


/** Confirmação de mandar para a lixeira (dá para restaurar depois). */
export function LixeiraDialog({
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
          <AlertDialogTitle>Mover “{no?.nome}” para a lixeira?</AlertDialogTitle>
          <AlertDialogDescription>
            {no?.tipo === "pasta"
              ? "A pasta e tudo o que está dentro dela vão para a lixeira. Você pode restaurar quando quiser."
              : "O arquivo e as versões dele vão para a lixeira. Você pode restaurar quando quiser."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar}>Mover para a lixeira</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Arquivos com nome que já existe na pasta: o que fazer com eles. */
export function ConflitoDialog({
  nomes,
  onClose,
  onEscolher,
}: {
  nomes: string[] | null;
  onClose: () => void;
  onEscolher: (r: ResolucaoConflito) => void;
}) {
  const lista = nomes ?? [];
  return (
    <Dialog open={lista.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lista.length === 1 ? "Este arquivo já existe aqui" : `${lista.length} arquivos já existem aqui`}
          </DialogTitle>
          <DialogDescription>
            Guardar como nova versão mantém o histórico (dá para voltar à anterior).
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-32 space-y-1 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 text-sm">
          {lista.slice(0, 20).map((n) => (
            <li key={n} className="truncate">
              {n}
            </li>
          ))}
          {lista.length > 20 && <li className="text-muted-foreground">e mais {lista.length - 20}…</li>}
        </ul>
        <div className="grid gap-2">
          <Button onClick={() => onEscolher("versao")}>Guardar como nova versão</Button>
          <Button variant="outline" onClick={() => onEscolher("manter")}>
            Manter os dois (renomear o novo)
          </Button>
          <Button variant="ghost" onClick={() => onEscolher("pular")}>
            Não enviar estes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Dono/admin muda a cota de armazenamento do escritório. */
export function CotaDialog({
  aberto,
  limiteAtual,
  onClose,
  onSalvar,
}: {
  aberto: boolean;
  limiteAtual: number;
  onClose: () => void;
  onSalvar: (gb: number) => void;
}) {
  const [gb, setGb] = useState("");
  useEffect(() => {
    if (aberto) setGb(String(Math.round(limiteAtual / 1024 ** 3) || 10));
  }, [aberto, limiteAtual]);
  const valor = Number(gb.replace(",", "."));
  const valido = Number.isFinite(valor) && valor >= 1 && valor <= 10000;
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Espaço de armazenamento</DialogTitle>
          <DialogDescription>
            Limite do escritório, somando todas as versões e a lixeira.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Input
            autoFocus
            inputMode="decimal"
            value={gb}
            onChange={(e) => setGb(e.target.value)}
            className="w-28"
            aria-label="Limite em GB"
          />
          GB
        </label>
        {!valido && <p className="text-xs text-destructive">Informe de 1 a 10.000 GB.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={() => onSalvar(valor)}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
