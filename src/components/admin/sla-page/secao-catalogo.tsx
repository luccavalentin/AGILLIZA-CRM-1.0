import { useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  salvarCatalogoItem,
  excluirCatalogoItem,
  type CatalogoItem,
  type CategoriaCatalogo,
} from "@/lib/admin/sla.functions";

interface CatForm {
  id?: string;
  valor: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function SecaoCatalogo({
  categoria,
  titulo,
  icon,
  q,
}: {
  categoria: CategoriaCatalogo;
  titulo: string;
  icon: React.ReactNode;
  q: UseQueryResult<CatalogoItem[]>;
}) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarCatalogoItem);
  const excluir = useServerFn(excluirCatalogoItem);
  const [aberto, setAberto] = useState(false);
  const vazio: CatForm = { valor: "", label: "", ordem: 0, ativo: true };
  const [form, setForm] = useState<CatForm>(vazio);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-sla-catalogo", categoria] });

  const salvarM = useMutation({
    mutationFn: (f: CatForm) =>
      salvar({
        data: {
          id: f.id,
          categoria,
          valor: f.id ? f.valor : f.valor || slugify(f.label),
          label: f.label,
          ordem: f.ordem,
          ativo: f.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Item salvo.");
      setAberto(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    const prox = q.data?.length ?? 0;
    setForm({ ...vazio, ordem: prox });
    setAberto(true);
  }
  function editar(i: CatalogoItem) {
    setForm({ id: i.id, valor: i.valor, label: i.label, ordem: i.ordem, ativo: i.ativo });
    setAberto(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {titulo}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item.</p>
        ) : (
          <ul className="divide-y divide-border">
            {q.data!.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{i.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.valor}
                    {!i.ativo && " · inativo"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => editar(i)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    titulo="Remover item?"
                    descricao="Regras de SLA que usam este valor deixarão de correspondê-lo."
                    onConfirm={() => excluirM.mutateAsync(i.id).then(() => {})}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar" : "Novo"} — {titulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome exibido</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex.: Análise de documento"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código {form.id ? "" : "(opcional)"}</Label>
              <Input
                value={form.valor}
                disabled={!!form.id}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="gerado automaticamente"
              />
              <p className="text-xs text-muted-foreground">
                Letras, números e sublinhado. Não pode ser alterado depois de criado.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.ordem}
                  onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-end justify-between rounded-md border border-border p-3">
                <Label htmlFor={`cat-ativo-${categoria}`}>Ativo</Label>
                <Switch
                  id={`cat-ativo-${categoria}`}
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (form.label.trim().length < 1) return toast.error("Informe o nome.");
                salvarM.mutate(form);
              }}
              disabled={salvarM.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
