import { AdminHero } from "@/components/admin/admin-hero";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModuloPermitido } from "@/lib/route-guards";
import { getMinhaSessao } from "@/lib/session.functions";
import { listarCompras, criarCompra, decidirCompra } from "@/lib/admin/compras.functions";

export const Route = createFileRoute("/_authenticated/admin/compras")({
  head: () => ({ meta: [{ title: "Compras — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.compras"),
  component: Pagina,
});

const brl = (n: number) => n.toLocaleString("pt-BR", {  style: "currency", currency: "BRL" });

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "aprovada") return "default";
  if (s === "recusada") return "destructive";
  return "secondary";
}

function Pagina() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");

  const sessao = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const podeAprovar = ["admin", "correspondente", "gestor"].some((r) =>
    (sessao.data?.roles ?? []).includes(r as never),
  );

  const q = useQuery({ queryKey: ["admin-compras"], queryFn: () => listarCompras() });

  const criar = useMutation({
    mutationFn: () =>
      criarCompra({
        data: {
          descricao,
          valor: Number(valor.replace(",", ".")) || 0,
          categoria: categoria || null,
        },
      }),
    onSuccess: () => {
      toast.success("Solicitação registrada.");
      setAberto(false);
      setDescricao("");
      setValor("");
      setCategoria("");
      qc.invalidateQueries({ queryKey: ["admin-compras"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar."),
  });

  const decidir = useMutation({
    mutationFn: (v: { id: string; aprovar: boolean }) => decidirCompra({ data: v }),
    onSuccess: () => {
      toast.success("Decisão registrada.");
      qc.invalidateQueries({ queryKey: ["admin-compras"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na decisão."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShoppingCart className="h-5 w-5" />}
        titulo="Compras"
        descricao="Solicitações e aprovações de compra."
        acoes={
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> Nova solicitação
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova solicitação de compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-desc">Descrição</Label>
                <Input
                  id="c-desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="c-valor">Valor (R$)</Label>
                  <Input
                    id="c-valor"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-cat">Categoria</Label>
                  <Input
                    id="c-cat"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => criar.mutate()}
                disabled={criar.isPending || descricao.trim().length < 3}
              >
                {criar.isPending ? "Salvando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              {podeAprovar && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={podeAprovar ? 6 : 5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={podeAprovar ? 6 : 5}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhuma solicitação de compra.
                </TableCell>
              </TableRow>
            ) : (
              (q.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {c.numero ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{c.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.solicitante_nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(c.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  {podeAprovar && (
                    <TableCell className="text-right">
                      {c.status === "pendente" ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={decidir.isPending}
                            onClick={() => decidir.mutate({ id: c.id, aprovar: true })}
                          >
                            <Check className="size-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={decidir.isPending}
                            onClick={() => decidir.mutate({ id: c.id, aprovar: false })}
                          >
                            <X className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
