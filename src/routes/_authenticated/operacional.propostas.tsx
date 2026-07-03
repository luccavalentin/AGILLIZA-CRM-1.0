import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, KanbanSquare } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { formatBRL } from "@/lib/simulacao/format";

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as propostas.</div>
  ),
});

function Pagina() {
  const router = useRouter();
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["propostas", escopo, busca],
    queryFn: () => listarPropostas({ data: { escopo, q: busca || undefined, pagina: 1, porPagina: 30 } }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Propostas</h1>
          <p className="text-sm text-muted-foreground">Oportunidades enviadas ao banco.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/operacional/propostas/kanban">
              <KanbanSquare className="mr-1 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <Button asChild>
            <Link to="/operacional/propostas/enviar">
              <Plus className="mr-1 h-4 w-4" /> Nova oportunidade
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
          <TabsList>
            <TabsTrigger value="todas">Gerais</TabsTrigger>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          className="flex w-full max-w-sm items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setBusca(q);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Número, cliente ou documento"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
        </form>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead className="text-right">R$ Financiamento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.itens.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
                    <Button asChild size="sm">
                      <Link to="/operacional/propostas/enviar">Nova oportunidade</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.itens.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })}
              >
                <TableCell className="font-medium">{p.numero_proposta}</TableCell>
                <TableCell>{p.nome_cliente ?? "—"}</TableCell>
                <TableCell>{p.nome_banco ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(p.valor_financiamento)}</TableCell>
                <TableCell><PropostaStatusBadge status={p.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
