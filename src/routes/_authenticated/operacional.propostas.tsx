import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, FileText, KanbanSquare } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, excluirProposta } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { BancosProposta } from "@/components/proposta/bancos-proposta";
import { StatusBancosProposta } from "@/components/proposta/status-bancos-proposta";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
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
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirProposta);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["propostas", escopo, busca],
    queryFn: () =>
      listarPropostas({ data: { escopo, q: busca || undefined, pagina: 1, porPagina: 30 } }),
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Proposta excluída.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch {
      toast.error("Não foi possível excluir a proposta.");
    }
  }

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
              <Plus className="mr-1 h-4 w-4" /> Nova proposta
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
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Bancos</TableHead>
              <TableHead className="text-right">R$ Financiamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.itens.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
                    <Button asChild size="sm">
                      <Link to="/operacional/propostas/enviar">Nova proposta</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.itens.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() =>
                  router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                }
              >
                <TableCell>
                  <div className="font-medium tabular-nums">
                    {p.numero_proposta_banco ?? p.numero_proposta}
                  </div>
                  {p.numero_proposta_banco && (
                    <div className="text-[11px] text-muted-foreground">
                      Interno {p.numero_proposta}
                    </div>
                  )}
                </TableCell>
                <TableCell>{p.nome_cliente ?? "—"}</TableCell>
                <TableCell><BancosProposta bancos={p.bancos} /></TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(p.valor_financiamento)}
                </TableCell>
                <TableCell>
                  <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <ConfirmDelete
                    titulo="Excluir proposta"
                    descricao={`A proposta ${p.numero_proposta} será removida permanentemente. Um registro completo será mantido nos Logs de auditoria.`}
                    onConfirm={() => handleExcluir(p.id)}
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
