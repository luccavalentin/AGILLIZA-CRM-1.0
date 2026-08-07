import { AdminHero } from "@/components/admin/admin-hero";
import { useState, useMemo } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Check, X, Search, ClipboardList } from "lucide-react";
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
import { listarCompras, decidirCompra, type CompraLinha } from "@/lib/admin/compras.functions";

export const Route = createFileRoute("/_authenticated/admin/compras/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovação de Compras — Agilliza" }] }),
  beforeLoad: async () => {
    assertModuloPermitido("admin.compras.aprovacoes", ["admin.compras"]);
    const sessao = await getMinhaSessao();
    const pode = ["admin", "correspondente", "gestor"].some((r) =>
      (sessao.roles ?? []).includes(r as never),
    );
    if (!pode) throw redirect({ to: "/admin/compras/pedidos" });
  },
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
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"pendente" | "aprovada" | "recusada" | "todas">("pendente");
  const [dialogo, setDialogo] = useState<{ compra: CompraLinha; aprovar: boolean } | null>(null);
  const [observacao, setObservacao] = useState("");

  const q = useQuery({ queryKey: ["admin-compras"], queryFn: () => listarCompras() });

  const { pendentes, aprovadas, recusadas, filtradas, total } = useMemo(() => {
    const lista = q.data ?? [];
    const pend = lista.filter((c) => c.status === "pendente");
    const apr = lista.filter((c) => c.status === "aprovada");
    const rec = lista.filter((c) => c.status === "recusada");
    const base =
      aba === "pendente" ? pend : aba === "aprovada" ? apr : aba === "recusada" ? rec : lista;
    const filt = base.filter((c) =>
      busca.trim() === ""
        ? true
        : `${c.descricao} ${c.categoria ?? ""} ${c.solicitante_nome ?? ""} ${c.numero ?? ""}`
            .toLowerCase()
            .includes(busca.toLowerCase()),
    );
    return {
      pendentes: pend,
      aprovadas: apr,
      recusadas: rec,
      filtradas: filt,
      total: pend.reduce((sum, c) => sum + Number(c.valor || 0), 0),
    };
  }, [q.data, aba, busca]);

  const decidir = useMutation({
    mutationFn: (v: { id: string; aprovar: boolean; observacao: string | null }) =>
      decidirCompra({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.aprovar ? "Pedido aprovado." : "Pedido recusado.");
      qc.invalidateQueries({ queryKey: ["admin-compras"] });
      setDialogo(null);
      setObservacao("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na decisão."),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="Aprovação de Compras"
        descricao="Analise os pedidos enviados pela equipe e decida aprovar ou recusar."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Aguardando" value={pendentes.length} tone="secondary" />
        <KpiCard label="Valor pendente" value={brl(total)} tone="outline" />
        <KpiCard label="Aprovadas" value={aprovadas.length} tone="default" />
        <KpiCard label="Recusadas" value={recusadas.length} tone="destructive" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por solicitante, descrição, nº…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["pendente", "Aguardando"],
            ["aprovada", "Aprovadas"],
            ["recusada", "Recusadas"],
            ["todas", "Todas"],
          ] as const).map(([v, l]) => (
            <Button
              key={v}
              variant={aba === v ? "default" : "outline"}
              size="sm"
              onClick={() => setAba(v)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-60" />
                  Nenhum pedido nesta visão.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{c.numero ?? "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{c.solicitante_nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.categoria ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(c.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.status === "pendente" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setObservacao("");
                            setDialogo({ compra: c, aprovar: true });
                          }}
                        >
                          <Check className="mr-1 size-4 text-primary" /> Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setObservacao("");
                            setDialogo({ compra: c, aprovar: false });
                          }}
                        >
                          <X className="mr-1 size-4 text-destructive" /> Recusar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {c.aprovado_em
                          ? new Date(c.aprovado_em).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogo !== null} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogo?.aprovar ? "Aprovar pedido" : "Recusar pedido"}
            </DialogTitle>
          </DialogHeader>
          {dialogo && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{dialogo.compra.descricao}</p>
                <p className="text-muted-foreground">
                  Solicitado por {dialogo.compra.solicitante_nome ?? "—"} · {brl(dialogo.compra.valor)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs">
                  Observação {dialogo.aprovar ? "(opcional)" : "(recomendado)"}
                </Label>
                <Textarea
                  id="obs"
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder={
                    dialogo.aprovar
                      ? "Ex.: Aprovado dentro do orçamento mensal."
                      : "Ex.: Fora do orçamento no momento."
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button
              variant={dialogo?.aprovar ? "default" : "destructive"}
              disabled={decidir.isPending}
              onClick={() =>
                dialogo &&
                decidir.mutate({
                  id: dialogo.compra.id,
                  aprovar: dialogo.aprovar,
                  observacao: observacao.trim() || null,
                })
              }
            >
              {decidir.isPending
                ? "Registrando…"
                : dialogo?.aprovar
                  ? "Confirmar aprovação"
                  : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "outline",
}: {
  label: string;
  value: number | string;
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
