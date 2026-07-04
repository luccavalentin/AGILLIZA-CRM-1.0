import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPropostas, moverStatusProposta } from "@/lib/propostas/propostas.functions";
import { statusProposta } from "@/components/propostas/status";
import { transicaoPermitida, type PropostaStatus } from "@/lib/propostas/state-machine";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/propostas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
});

const COLUNAS: PropostaStatus[] = [
  "rascunho",
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
  "registrado",
  "credito_recusado",
  "erro_envio",
  "cancelada",
];

const TONE_BAR: Record<string, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

function Pagina() {
  const router = useRouter();
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusProposta);
  const [arrastando, setArrastando] = useState<{ id: string; status: PropostaStatus } | null>(null);

  const { data } = useQuery({
    queryKey: ["propostas", "kanban"],
    queryFn: () => listarPropostas({ data: { escopo: "todas", pagina: 1, porPagina: 100 } }),
  });

  async function soltar(coluna: PropostaStatus) {
    if (!arrastando) return;
    const { id, status } = arrastando;
    setArrastando(null);
    if (status === coluna) return;
    if (!transicaoPermitida(status, coluna)) {
      toast.error(`Transição inválida: ${statusProposta(status).label} → ${statusProposta(coluna).label}.`);
      return;
    }
    try {
      await moverFn({ data: { proposta_id: id, novo_status: coluna } });
      qc.invalidateQueries({ queryKey: ["propostas", "kanban"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  const itens = data?.itens ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kanban de Propostas</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre etapas permitidas.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/propostas"><ArrowLeft className="mr-1 h-4 w-4" /> Lista</Link>
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((col) => {
          const cfg = statusProposta(col);
          const cards = itens.filter((i) => i.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(col)}
              className="flex w-64 flex-shrink-0 flex-col rounded-lg border border-border bg-muted/30"
            >
              <div className="overflow-hidden rounded-t-lg">
                <div className={cn("h-[3px]", TONE_BAR[cfg.tone])} />
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setArrastando({ id: c.id, status: c.status as PropostaStatus })}
                    onClick={() => router.navigate({ to: "/operacional/propostas/$id", params: { id: c.id } })}
                    className="cursor-grab rounded-md border border-border bg-card p-3 text-sm shadow-sm active:cursor-grabbing"
                  >
                    <p className="font-medium text-foreground">{c.numero_proposta}</p>
                    <p className="text-xs text-muted-foreground">{c.nome_cliente ?? "—"}</p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {c.nome_banco ?? "—"} · {formatBRL(c.valor_financiamento)}
                    </p>
                  </div>
                ))}
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
