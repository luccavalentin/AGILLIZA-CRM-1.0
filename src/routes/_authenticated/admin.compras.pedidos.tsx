import { AdminHero } from "@/components/admin/admin-hero";
import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { listarCompras, criarCompra } from "@/lib/admin/compras.functions";

export const Route = createFileRoute("/_authenticated/admin/compras/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos de Compras — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.compras"),
  component: Pagina,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const [justificativa, setJustificativa] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "aprovada" | "recusada">("todos");

  const sessao = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const meuId = sessao.data?.profile?.id ?? null;

  const q = useQuery({ queryKey: ["admin-compras"], queryFn: () => listarCompras() });

  const meusPedidos = useMemo(() => {
    const lista = q.data ?? [];
    return lista
      .filter((c) => (meuId ? c.solicitante_id === meuId : true))
      .filter((c) => filtroStatus === "todos" || c.status === filtroStatus)
      .filter((c) =>
        busca.trim() === ""
          ? true
          : `${c.descricao} ${c.categoria ?? ""} ${c.numero ?? ""}`
              .toLowerCase()
              .includes(busca.toLowerCase()),
      );
  }, [q.data, meuId, filtroStatus, busca]);

  const kpis = useMemo(() => {
    const meus = (q.data ?? []).filter((c) => (meuId ? c.solicitante_id === meuId : false));
    return {
      total: meus.length,
      pendentes: meus.filter((c) => c.status === "pendente").length,
      aprovadas: meus.filter((c) => c.status === "aprovada").length,
      recusadas: meus.filter((c) => c.status === "recusada").length,
    };
  }, [q.data, meuId]);

  const criar = useMutation({
    mutationFn: () =>
      criarCompra({
        data: {
          descricao: justificativa.trim()
            ? `${descricao} — ${justificativa.trim()}`
            : descricao,
          valor: Number(valor.replace(/\./g, "").replace(",", ".")) || 0,
          categoria: categoria || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pedido enviado para aprovação.");
      setAberto(false);
      setDescricao("");
      setValor("");
      setCategoria("");
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["admin-compras"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShoppingCart className="h-5 w-5" />}
        titulo="Pedidos de Compras"
        descricao="Envie solicitações de compra e acompanhe o status da aprovação pela gestão."
        acoes={
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" /> Novo pedido
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo pedido de compra</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-desc">O que precisa ser comprado?</Label>
                  <Input
                    id="c-desc"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: Cadeiras ergonômicas para o escritório"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-valor">Valor estimado (R$)</Label>
                    <Input
                      id="c-valor"
                      inputMode="decimal"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-cat">Categoria</Label>
                    <Input
                      id="c-cat"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      placeholder="Ex.: Mobiliário, TI, Marketing"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-just">Justificativa (opcional)</Label>
                  <Textarea
                    id="c-just"
                    rows={3}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Explique por que essa compra é necessária."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => criar.mutate()}
                  disabled={criar.isPending || descricao.trim().length < 3}
                >
                  {criar.isPending ? "Enviando…" : "Enviar para aprovação"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Meus pedidos" value={kpis.total} />
        <KpiCard label="Pendentes" value={kpis.pendentes} tone="secondary" />
        <KpiCard label="Aprovadas" value={kpis.aprovadas} tone="default" />
        <KpiCard label="Recusadas" value={kpis.recusadas} tone="destructive" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, categoria ou nº…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "pendente", "aprovada", "recusada"] as const).map((s) => (
            <Button
              key={s}
              variant={filtroStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStatus(s)}
            >
              {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : meusPedidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum pedido encontrado. Clique em “Novo pedido” para começar.
                </TableCell>
              </TableRow>
            ) : (
              meusPedidos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{c.numero ?? "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{c.categoria ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(c.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "outline",
}: {
  label: string;
  value: number;
  tone?: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <Badge variant={tone} className="text-[10px]">
          {label}
        </Badge>
      </div>
    </div>
  );
}
