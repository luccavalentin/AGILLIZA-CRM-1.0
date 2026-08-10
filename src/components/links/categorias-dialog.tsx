import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  type LinkCategoria,
  listarCategoriasLinks,
  criarCategoriaLink,
  atualizarCategoriaLink,
  excluirCategoriaLink,
} from "@/lib/links/links.functions";
import {
  ICONES_CATEGORIA,
  CORES_CATEGORIA,
  iconeCategoria,
  classeCategoria,
} from "@/lib/links/categorias-icones";
import { cn } from "@/lib/utils";

interface Rascunho {
  nome: string;
  icone: string;
  cor: string;
}

const VAZIO: Rascunho = { nome: "", icone: "banco", cor: "azul" };

export function CategoriasLinksDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarCategoriasLinks);
  const criarFn = useServerFn(criarCategoriaLink);
  const atualizarFn = useServerFn(atualizarCategoriaLink);
  const excluirFn = useServerFn(excluirCategoriaLink);

  const { data, isLoading } = useQuery({
    queryKey: ["links-categorias"],
    queryFn: () => listar(),
  });

  const [novo, setNovo] = useState<Rascunho | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [excluindo, setExcluindo] = useState<LinkCategoria | null>(null);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["links-categorias"] });
    qc.invalidateQueries({ queryKey: ["links"] });
  }

  const criar = useMutation({
    mutationFn: (r: Rascunho) => criarFn({ data: r }),
    onSuccess: () => {
      toast.success("Categoria criada.");
      setNovo(null);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar categoria."),
  });

  const atualizar = useMutation({
    mutationFn: (v: Rascunho & { id: string }) => atualizarFn({ data: v }),
    onSuccess: () => {
      toast.success("Categoria atualizada.");
      setEditandoId(null);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar categoria."),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id, moverPara: null } }),
    onSuccess: () => {
      toast.success("Categoria excluída.");
      setExcluindo(null);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir categoria."),
  });

  function Editor({
    valor,
    onChange,
  }: {
    valor: Rascunho;
    onChange: (r: Rascunho) => void;
  }) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome</Label>
          <Input
            value={valor.nome}
            autoFocus
            onChange={(e) => onChange({ ...valor, nome: e.target.value })}
            placeholder="Ex.: Bancos, Cartórios, Prefeituras…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ícone</Label>
          <div className="flex flex-wrap gap-1.5">
            {ICONES_CATEGORIA.map(({ valor: v, label, Icon }) => (
              <button
                key={v}
                type="button"
                title={label}
                onClick={() => onChange({ ...valor, icone: v })}
                className={cn(
                  "grid size-9 place-items-center rounded-lg ring-1 transition-colors",
                  valor.icone === v
                    ? classeCategoria(valor.cor)
                    : "bg-muted/50 text-muted-foreground ring-border hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cor</Label>
          <div className="flex flex-wrap gap-1.5">
            {CORES_CATEGORIA.map((c) => (
              <button
                key={c.valor}
                type="button"
                title={c.label}
                onClick={() => onChange({ ...valor, cor: c.valor })}
                className={cn(
                  "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform",
                  c.dot,
                  valor.cor === c.valor ? "ring-foreground/40 scale-110" : "ring-transparent",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl">
        <DialogHeader>
          <DialogTitle>Categorias de links</DialogTitle>
          <DialogDescription>
            Crie, edite ou exclua categorias e escolha um ícone e uma cor para cada uma.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : (data ?? []).length === 0 && !novo ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma categoria cadastrada ainda.
            </p>
          ) : (
            (data ?? []).map((c) => {
              const Icon = iconeCategoria(c.icone);
              const emEdicao = editandoId === c.id;
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                  {emEdicao ? (
                    <div className="space-y-3">
                      <Editor valor={rascunho} onChange={setRascunho} />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditandoId(null)}>
                          <X className="mr-1 h-4 w-4" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          disabled={atualizar.isPending || !rascunho.nome.trim()}
                          onClick={() => atualizar.mutate({ id: c.id, ...rascunho })}
                        >
                          {atualizar.isPending ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl ring-1",
                          classeCategoria(c.cor),
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nome}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditandoId(c.id);
                          setRascunho({ nome: c.nome, icone: c.icone, cor: c.cor });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setExcluindo(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {novo && (
            <div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
              <Editor valor={novo} onChange={setNovo} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNovo(null)}>
                  <X className="mr-1 h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={criar.isPending || !novo.nome.trim()}
                  onClick={() => criar.mutate(novo)}
                >
                  {criar.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Criar
                </Button>
              </div>
            </div>
          )}
        </div>

        {!novo && (
          <Button variant="outline" onClick={() => setNovo({ ...VAZIO })}>
            <Plus className="mr-2 h-4 w-4" />
            Nova categoria
          </Button>
        )}

        <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
              <AlertDialogDescription>
                A categoria "{excluindo?.nome}" será removida e os links vinculados ficarão sem
                categoria. Os links não são excluídos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => excluindo && excluir.mutate(excluindo.id)}
                disabled={excluir.isPending}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
