import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Kanban } from "lucide-react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OpHero } from "@/components/operacional/ui";
import {
  assumirDemanda,
  centralDemandas,
  configDemandas,
  mudarStatusDemanda,
  type DemandaCentralItem,
} from "@/lib/operacional/demandas-central.functions";
import {
  estadoPrazo,
  exigeEncerrar,
  ROTULO_STATUS_DEMANDA,
  STATUS_DEMANDA_ORDEM,
  transicaoDemandaPermitida,
  type DemandaEscopo,
  type DemandaOrigem,
  type DemandaPrioridade,
  type DemandaStatus,
} from "@/lib/operacional/demandas-regras";
import { CartaoDemanda } from "@/components/demandas/cartao-demanda";
import { NovaDemandaDialog } from "@/components/demandas/nova-demanda-dialog";
import {
  AbasEscopo,
  FaixaFiltros,
  FILTROS_VAZIOS,
  MotivoDialog,
  VisoesDemandas,
  type FiltrosDemanda,
} from "@/components/demandas/barra-demandas";
import { COR_STATUS, VazioDemandas } from "@/components/demandas/pecas";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

/**
 * Kanban das demandas por situação (C36). Arrastar valida a transição (mesma tabela do
 * banco), concluir/cancelar exigem "encerrar" e cancelar pede o motivo. Soltar em
 * "Em andamento" uma demanda sem responsável = assumir.
 */
function Pagina() {
  const qc = useQueryClient();
  const [escopo, setEscopo] = useState<DemandaEscopo>("equipe");
  const [f, setF] = useState<FiltrosDemanda>(FILTROS_VAZIOS);
  const [termo, setTermo] = useState("");
  const [arrastando, setArrastando] = useState<DemandaCentralItem | null>(null);
  const [sobre, setSobre] = useState<DemandaStatus | null>(null);
  const [cancelar, setCancelar] = useState<DemandaCentralItem | null>(null);
  const [assumindo, setAssumindo] = useState<string | null>(null);
  const podeCriar = usePermissao("operacional.demandas", "create");
  const mover = useServerFn(mudarStatusDemanda);
  const assumir = useServerFn(assumirDemanda);

  useEffect(() => {
    const t = setTimeout(() => setTermo(f.termo.trim()), 300);
    return () => clearTimeout(t);
  }, [f.termo]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["demandas-central", "kanban", escopo, termo, f.tipo, f.origem, f.prioridade],
    queryFn: () =>
      centralDemandas({
        data: {
          escopo,
          termo: termo || null,
          tipo: f.tipo !== "todos" ? f.tipo : null,
          origem: f.origem !== "todas" ? (f.origem as DemandaOrigem) : null,
          prioridade: f.prioridade !== "todas" ? (f.prioridade as DemandaPrioridade) : null,
          encerradas_dias: 7,
        },
      }),
    refetchInterval: 60_000,
  });
  const { data: cfg } = useQuery({
    queryKey: ["demandas-config"],
    queryFn: () => configDemandas(),
    staleTime: 60_000,
  });
  useRealtimeInvalidate("demandas-kanban", [["demandas-central"]], ["demandas"]);

  const colunas = useMemo(() => {
    const m = new Map<DemandaStatus, DemandaCentralItem[]>();
    for (const s of STATUS_DEMANDA_ORDEM) m.set(s, []);
    for (const d of data?.itens ?? []) m.get(d.status)?.push(d);
    return m;
  }, [data]);

  async function soltar(para: DemandaStatus) {
    const d = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!d || d.status === para) return;
    if (!transicaoDemandaPermitida(d.status, para)) {
      toast.error(`De "${ROTULO_STATUS_DEMANDA[d.status]}" não vai direto para "${ROTULO_STATUS_DEMANDA[para]}".`);
      return;
    }
    if (para === "cancelada") {
      setCancelar(d);
      return;
    }
    try {
      if (para === "em_andamento" && !d.responsavel_id) {
        await assumir({ data: { id: d.id } });
        toast.success("Demanda assumida.");
      } else {
        await mover({ data: { id: d.id, status: para } });
        toast.success(`Movida para ${ROTULO_STATUS_DEMANDA[para]}.`);
      }
      qc.invalidateQueries({ queryKey: ["demandas-central"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível mover."));
      refetch();
    }
  }

  async function onAssumir(id: string) {
    setAssumindo(id);
    try {
      await assumir({ data: { id } });
      toast.success("Demanda assumida.");
      qc.invalidateQueries({ queryKey: ["demandas-central"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível assumir."));
      refetch();
    } finally {
      setAssumindo(null);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">
      <OpHero
        icon={<Kanban className="h-6 w-6" />}
        eyebrow="Operacional · Demandas"
        titulo="Kanban de demandas"
        descricao="Arraste entre as situações. A regra é a mesma do banco: a coluna que não aceita a demanda fica apagada."
        acoes={
          <>
            <VisoesDemandas atual="kanban" />
            {podeCriar && <NovaDemandaDialog onCriada={() => qc.invalidateQueries({ queryKey: ["demandas-central"] })} />}
          </>
        }
      />
      <AbasEscopo atual={escopo} onTrocar={(a) => a !== "config" && setEscopo(a)} contadores={data?.contadores} />
      <FaixaFiltros f={f} onF={setF} tipos={cfg?.tipos ?? []} />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {STATUS_DEMANDA_ORDEM.map((s) => (
            <div key={s} className="h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : isError ? (
        <VazioDemandas
          titulo="Não foi possível carregar o kanban"
          texto={mensagemDeErro(error, "Tente de novo em instantes.")}
          acao={<Button onClick={() => refetch()}>Tentar de novo</Button>}
        />
      ) : (
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-max auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 xl:min-w-0">
            {STATUS_DEMANDA_ORDEM.map((s) => {
              const itens = colunas.get(s) ?? [];
              const atrasadas = itens.filter((d) => estadoPrazo(d.prazo_sla, d.status) === "atrasada").length;
              const aceita = arrastando ? transicaoDemandaPermitida(arrastando.status, s) && arrastando.status !== s : true;
              return (
                <section
                  key={s}
                  onDragOver={(e) => {
                    if (!arrastando || !aceita) return;
                    e.preventDefault();
                    setSobre(s);
                  }}
                  onDragLeave={() => setSobre((x) => (x === s ? null : x))}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltar(s);
                  }}
                  className={cn(
                    "flex max-h-[calc(100dvh-16rem)] min-h-64 flex-col rounded-2xl border border-border/70 bg-muted/25 transition",
                    arrastando && !aceita && "opacity-45",
                    arrastando && aceita && "border-dashed border-primary/50",
                    sobre === s && "bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                      <span className={cn("size-2 rounded-full", COR_STATUS[s].ponto)} />
                      {ROTULO_STATUS_DEMANDA[s]}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {atrasadas > 0 && (
                        <span className="rounded-full bg-destructive/10 px-1.5 text-[10.5px] font-semibold text-destructive">
                          {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="rounded-full bg-card px-2 text-[11px] font-semibold tabular-nums ring-1 ring-border">
                        {itens.length}
                      </span>
                    </span>
                  </header>
                  <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
                    {itens.length === 0 ? (
                      <p className="px-2 py-8 text-center text-[11.5px] text-muted-foreground">
                        {exigeEncerrar(s) ? "Encerradas nos últimos 7 dias aparecem aqui." : "Nada aqui."}
                      </p>
                    ) : (
                      itens.map((d) => (
                        <CartaoDemanda
                          key={d.id}
                          d={d}
                          tipos={cfg?.tipos}
                          mostrarStatus={false}
                          arrastavel
                          onDragStart={(e, x) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", x.id);
                            setArrastando(x);
                          }}
                          onAssumir={onAssumir}
                          assumindo={assumindo === d.id}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <MotivoDialog
        aberto={!!cancelar}
        titulo="Cancelar demanda"
        descricao="O motivo vai para o histórico e quem participa é avisado."
        rotulo="Cancelar demanda"
        onFechar={() => setCancelar(null)}
        onConfirmar={async (motivo) => {
          if (!cancelar) return;
          try {
            await mover({ data: { id: cancelar.id, status: "cancelada", motivo } });
            toast.success("Demanda cancelada.");
            setCancelar(null);
            qc.invalidateQueries({ queryKey: ["demandas-central"] });
          } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível cancelar."));
          }
        }}
      />
    </div>
  );
}
