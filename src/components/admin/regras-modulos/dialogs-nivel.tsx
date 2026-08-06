import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  PAPEIS_POR_PORTAL,
  type AcessoTipo,
  type NivelAcesso,
  type PapelNivel,
} from "@/lib/admin/regras-modulos.functions";
import { PORTAIS } from "./constants";

export function DialogNovoNivel({
  open,
  onOpenChange,
  nome,
  setNome,
  desc,
  setDesc,
  copiarDe,
  setCopiarDe,
  portal,
  setPortal,
  papel,
  setPapel,
  ajustarPapel,
  niveis,
  onCriar,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string;
  setNome: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  copiarDe: string;
  setCopiarDe: (v: string) => void;
  portal: AcessoTipo;
  setPortal: (v: AcessoTipo) => void;
  papel: PapelNivel;
  setPapel: (v: PapelNivel) => void;
  ajustarPapel: (portal: AcessoTipo, papel: PapelNivel) => PapelNivel;
  niveis: NivelAcesso[];
  onCriar: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo papel / função</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Supervisor" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Portal</Label>
              <Select
                value={portal}
                onValueChange={(v) => {
                  const p = v as AcessoTipo;
                  setPortal(p);
                  setPapel(ajustarPapel(p, papel));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTAIS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel / função</Label>
              <Select value={papel} onValueChange={(v) => setPapel(v as PapelNivel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS_POR_PORTAL[portal].map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Começar as permissões a partir de</Label>
            <Select value={copiarDe} onValueChange={setCopiarDe}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baseline">Somente visualização (padrão)</SelectItem>
                {niveis.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    Copiar de: {n.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O nível já nasce com uma matriz de permissões que você pode ajustar em seguida.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onCriar} disabled={nome.trim().length < 2 || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogEditarNivel({
  open,
  onOpenChange,
  nome,
  setNome,
  desc,
  setDesc,
  portal,
  setPortal,
  papel,
  setPapel,
  ajustarPapel,
  onSalvar,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string;
  setNome: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  portal: AcessoTipo;
  setPortal: (v: AcessoTipo) => void;
  papel: PapelNivel;
  setPapel: (v: PapelNivel) => void;
  ajustarPapel: (portal: AcessoTipo, papel: PapelNivel) => PapelNivel;
  onSalvar: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar papel / função</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-nome">Nome</Label>
            <Input id="edit-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Descrição</Label>
            <Input id="edit-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Portal</Label>
            <Select
              value={portal}
              onValueChange={(v) => {
                const p = v as AcessoTipo;
                setPortal(p);
                setPapel(ajustarPapel(p, papel));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PORTAIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSalvar} disabled={nome.trim().length < 2 || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogExcluirNivel({
  open,
  onOpenChange,
  nome,
  pending,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string | undefined;
  pending: boolean;
  onConfirmar: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir nível de acesso?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove o nível “{nome}” e todas as suas permissões. Não é possível excluir se
            houver pessoas usando este nível.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirmar();
            }}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
