import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Calculator } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarSimulacoes, excluirSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes")({
  head: () => ({ meta: [{ title: "Simulações — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as simulações.</div>
  ),
});

function Pagina() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirSimulacao);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["simulacoes", escopo, busca, desde, ate],
    queryFn: () =>
      listarSimulacoes({
        data: {
          escopo,
          q: busca || undefined,
          desde: desde || undefined,
          ate: ate || undefined,
          pagina: 1,
          porPagina: 30,
        },
      }),
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Simulação excluída.");
      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
    } catch {
      toast.error("Não foi possível excluir a simulação.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Simulações</h1>
          <p className="text-sm text-muted-foreground">Financiamento imobiliário e home equity.</p>
        </div>
        <Button asChild>
          <Link to="/operacional/simulacoes/nova">
            <Plus className="mr-1 h-4 w-4" /> Nova simulação
          </Link>
        </Button>
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
        </div>
        {(desde || ate) && (
          <Button variant="ghost" size="sm" onClick={() => { setDesde(""); setAte(""); }}>
            Limpar datas
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor imóvel</TableHead>
              <TableHead className="text-right">Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.itens.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
                    <Button asChild size="sm">
                      <Link to="/operacional/simulacoes/nova">Criar primeira simulação</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.itens.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() => router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })}
              >
                <TableCell className="font-medium">{s.numero_simulacao}</TableCell>
                <TableCell>{s.nome_cliente ?? "—"}</TableCell>
                <TableCell>
                  {s.produto === "home_equity" ? "Home Equity" : s.produto === "financiamento_imobiliario" ? "Financiamento" : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(s.valor_imovel)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.prazo ? `${s.prazo}m` : "—"}</TableCell>
                <TableCell><SimulacaoStatusBadge status={s.status} /></TableCell>
                <TableCell className="text-right">
                  <ConfirmDelete
                    titulo="Excluir simulação"
                    descricao={`A simulação ${s.numero_simulacao} será removida permanentemente.`}
                    onConfirm={() => handleExcluir(s.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
