import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ChevronRight, GripVertical, CalendarClock, Workflow, Users, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarPainel,
  definirEtapa,
  definirDatasVistoria,
  type PainelStage,
} from "@/lib/crm/clientes.functions";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>
  ),
});

interface Arrasto {
  clienteId: string;
  origem: string;
}

function Pagina() {
  usePipelineRealtime();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listar = useServerFn(listarPainel);
  const mover = useServerFn(definirEtapa);
  const salvarDatas = useServerFn(definirDatasVistoria);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const arrastouRef = useRef(false);

  const queryKey = ["crm-painel", desde, ate];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { desde: desde || undefined, ate: ate || undefined } }),
  });

  async function moverPara(codigoDestino: string) {
    const info = arrasto;
    setArrasto(null);
    setAlvo(null);
    if (!info || info.origem === codigoDestino) return;

    // Atualização otimista: move o card na hora.
    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    let clienteMovido: PainelStage["clientes"][number] | undefined;
    if (anterior) {
      const novo = anterior.map((s) => {
        if (s.codigo === info.origem) {
          const c = s.clientes.find((x) => x.id === info.clienteId);
          if (c) clienteMovido = c;
          return { ...s, clientes: s.clientes.filter((x) => x.id !== info.clienteId) };
        }
        return s;
      });
      if (clienteMovido) {
        const destino = novo.find((s) => s.codigo === codigoDestino);
        if (destino) destino.clientes = [...destino.clientes, clienteMovido];
      }
      qc.setQueryData(queryKey, novo);
    }

    try {
      await mover({ data: { cliente_id: info.clienteId, codigo_destino: codigoDestino } });
      toast.success("Etapa atualizada.");
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao mover o cliente.");
    } finally {
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function salvarDataVistoria(
    clienteId: string,
    campo: "vistoria_agendada_em" | "vistoria_concluida_em",
    valor: string,
  ) {
    const novoValor = valor || null;
    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    if (anterior) {
      qc.setQueryData(
        queryKey,
        anterior.map((s) => ({
          ...s,
          clientes: s.clientes.map((c) =>
            c.id === clienteId ? { ...c, [campo]: novoValor } : c,
          ),
        })),
      );
    }
    try {
      await salvarDatas({ data: { cliente_id: clienteId, [campo]: novoValor } });
      toast.success("Data da vistoria salva.");
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a data.");
    } finally {
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }


  const totalClientes = (data ?? []).reduce((acc, s) => acc + s.clientes.length, 0);
  const etapasAtivas = (data ?? []).filter((s) => s.clientes.length > 0).length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Workflow className="size-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Painel da esteira
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão das 12 etapas — arraste um cliente para mover manualmente.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm sm:flex">
            <Users className="size-4 text-primary" />
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {totalClientes}
            </span>
            <span className="text-xs text-muted-foreground">
              em {etapasAtivas} de 12 etapas
            </span>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-10 w-40 rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-10 w-40 rounded-xl shadow-sm"
            />
          </div>
          {(desde || ate) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={() => {
                setDesde("");
                setAte("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>


      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data!.map((stage, idx) => {
            const temClientes = stage.clientes.length > 0;
            const ehAlvo = alvo === stage.codigo && arrasto?.origem !== stage.codigo;
            return (
              <div
                key={stage.codigo}
                onDragOver={(e) => {
                  if (!arrasto) return;
                  e.preventDefault();
                  if (alvo !== stage.codigo) setAlvo(stage.codigo);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setAlvo((a) => (a === stage.codigo ? null : a));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  moverPara(stage.codigo);
                }}
                className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg ${
                  ehAlvo ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 origin-left transition-transform duration-300 ${
                    temClientes
                      ? "bg-gradient-to-r from-primary to-primary/40"
                      : "bg-gradient-to-r from-border to-transparent scale-x-100 group-hover:from-primary/40"
                  }`}
                />
                <div className="flex min-w-0 flex-col p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2.5 border-b border-border/70 pb-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums shadow-sm ring-1 transition-colors duration-300 ${
                          temClientes
                            ? "bg-primary/10 text-primary ring-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary"
                            : "bg-muted text-muted-foreground ring-border"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                        {stage.nome}
                      </span>
                    </div>
                    <span
                      className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums transition-colors duration-300 ${
                        temClientes
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stage.clientes.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {!temClientes ? (
                      <p
                        className={`rounded-lg border border-dashed px-3 py-5 text-center text-xs transition-colors ${
                          ehAlvo
                            ? "border-primary/60 bg-primary/5 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {ehAlvo ? "Solte aqui" : "Nenhum cliente"}
                      </p>
                    ) : (
                      stage.clientes.map((c) => {
                        const campoVistoria =
                          stage.codigo === "vistoria_agenda"
                            ? "vistoria_agendada_em"
                            : stage.codigo === "vistoria_ok"
                              ? "vistoria_concluida_em"
                              : null;
                        return (
                          <div
                            key={c.id}
                            className="rounded-lg border border-border bg-background transition-all duration-200 hover:border-primary/50 hover:shadow-md"
                          >
                            <button
                              draggable
                              onDragStart={(e) => {
                                arrastouRef.current = true;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", c.id);
                                setArrasto({ clienteId: c.id, origem: stage.codigo });
                              }}
                              onDragEnd={() => {
                                setArrasto(null);
                                setAlvo(null);
                                setTimeout(() => {
                                  arrastouRef.current = false;
                                }, 0);
                              }}
                              onClick={() => {
                                if (arrastouRef.current) return;
                                navigate({ to: "/crm/clientes/$id", params: { id: c.id } });
                              }}
                              className="group/card flex w-full cursor-grab items-center gap-2 rounded-lg p-2.5 text-left transition-colors hover:bg-primary/5 active:scale-[0.98] active:cursor-grabbing"
                            >
                              <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-all duration-200 group-hover/card:scale-110 group-hover/card:bg-primary group-hover/card:text-primary-foreground">
                                {c.nome.trim().charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover/card:text-primary">
                                  {c.nome}
                                </span>
                                <span className="block font-mono text-[11px] text-muted-foreground">
                                  {c.numero_cliente}
                                </span>
                              </span>
                              <ChevronRight className="size-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover/card:translate-x-0 group-hover/card:opacity-100" />
                            </button>
                            {campoVistoria && (
                              <div className="flex items-center gap-2 border-t border-border/70 px-2.5 py-2">
                                <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                                <label className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                  {stage.codigo === "vistoria_agenda"
                                    ? "Agendada"
                                    : "Concluída"}
                                </label>
                                <Input
                                  type="date"
                                  value={c[campoVistoria] ?? ""}
                                  onChange={(e) =>
                                    salvarDataVistoria(c.id, campoVistoria, e.target.value)
                                  }
                                  className="h-7 flex-1 px-2 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })

                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
