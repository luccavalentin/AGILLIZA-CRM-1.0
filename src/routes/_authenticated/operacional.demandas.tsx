import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, KanbanSquare } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarDemandas, escalarDemanda, excluirDemanda } from "@/lib/operacional/demandas.functions";
import { NovaDemandaDialog } from "@/components/operacional/nova-demanda-dialog";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { PRIORIDADE, statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas")({
  head: () => ({ meta: [{ title: "Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function Pagina() {
  const [escopo, setEscopo] = useState<"minhas" | "equipe">("equipe");
  const [q, setQ] = useState("");
  const escalarFn = useServerFn(escalarDemanda);
  const excluir = useServerFn(excluirDemanda);

  const { data, refetch } = useQuery({
    queryKey: ["demandas", escopo, q],
    queryFn: () => listarDemandas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

  async function verificarSla() {
    try {
      const r = await escalarFn({});
      toast.success(r.escalonadas > 0 ? `${r.escalonadas} demanda(s) escalonada(s).` : "Nenhuma demanda vencida.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar SLA.");
    }
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Demanda excluída.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a demanda.");
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">Solicitações formais entre equipes, com SLA e escalonamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={verificarSla}>
            <AlertTriangle className="mr-1 h-4 w-4" /> Verificar SLA
          </Button>
          <NovaDemandaDialog onCriada={refetch} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as any)}>
          <TabsList>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título…" className="max-w-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {itens.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma demanda encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">SLA</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itens.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-accent/50">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    <Link to="/operacional/demandas/$id" params={{ id: d.id }} className="hover:underline">{d.numero}</Link>
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    <Link to="/operacional/demandas/$id" params={{ id: d.id }} className="hover:underline">{d.titulo}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.nome_cliente ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.nome_responsavel ?? "—"}</td>
                  <td className="px-3 py-2">
                    <SlaCountdown inicio={d.sla_inicio} prazo={d.prazo_sla} concluida={d.status === "concluida"} concluidaEm={d.concluida_em} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-block h-1.5 w-8 rounded-full", PRIORIDADE[d.prioridade].bar)} />
                    <span className="ml-2 text-xs text-muted-foreground">{PRIORIDADE[d.prioridade].label}</span>
                  </td>
                  <td className="px-3 py-2"><ToneBadge tone={statusDemanda(d.status).tone}>{statusDemanda(d.status).label}</ToneBadge></td>
                  <td className="px-3 py-2 text-right">
                    <ConfirmDelete
                      titulo="Excluir demanda"
                      descricao={`A demanda ${d.numero} será removida permanentemente.`}
                      onConfirm={() => handleExcluir(d.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
