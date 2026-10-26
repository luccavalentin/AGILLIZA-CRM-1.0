import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarOff, Hand, Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Button } from "@/components/ui/button";
import { OpHero } from "@/components/operacional/ui";
import {
  assumirDemanda,
  centralDemandas,
  configDemandas,
  pegarProximaDemanda,
} from "@/lib/operacional/demandas-central.functions";
import type { DemandaEscopo, DemandaOrigem, DemandaPrioridade } from "@/lib/operacional/demandas-regras";
import { CartaoDemanda } from "@/components/demandas/cartao-demanda";
import { NovaDemandaDialog } from "@/components/demandas/nova-demanda-dialog";
import { ConfigDemandasView } from "@/components/demandas/config-demandas";
import {
  AbasEscopo,
  FaixaFiltros,
  FILTROS_VAZIOS,
  IndicadoresDemandas,
  VisoesDemandas,
  type FiltrosDemanda,
} from "@/components/demandas/barra-demandas";
import { VazioDemandas } from "@/components/demandas/pecas";

type Aba = DemandaEscopo | "config";
const ABAS: Aba[] = ["minhas", "sem_responsavel", "equipe", "criadas", "config"];

export const Route = createFileRoute("/_authenticated/operacional/demandas")({
  head: () => ({ meta: [{ title: "Central de demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: ABAS.includes(s.aba as Aba) ? (s.aba as Aba) : undefined,
  }),
  component: Pagina,
});

/**
 * Central de demandas (C36, design novo): minhas, sem responsável (fila), equipe e as que
 * pedi; indicadores de prazo; "pegar a próxima"; e a configuração da fila justa.
 */
function Pagina() {
  const { aba: abaUrl } = Route.useSearch();
  const aba: Aba = abaUrl ?? "minhas";
  const navigate = useNavigate({ from: "/operacional/demandas" });
  const qc = useQueryClient();
  const [f, setF] = useState<FiltrosDemanda>(FILTROS_VAZIOS);
  const [termo, setTermo] = useState("");
  const [sla, setSla] = useState<"atrasadas" | "vencendo" | null>(null);
  const [encerradas, setEncerradas] = useState(false);
  const [assumindo, setAssumindo] = useState<string | null>(null);
  const [pegando, setPegando] = useState(false);
  const podeCriar = usePermissao("operacional.demandas", "create");
  const assumir = useServerFn(assumirDemanda);
  const pegar = useServerFn(pegarProximaDemanda);

  useEffect(() => {
    const t = setTimeout(() => setTermo(f.termo.trim()), 300);
    return () => clearTimeout(t);
  }, [f.termo]);

  const escopo: DemandaEscopo = aba === "config" ? "minhas" : aba;
  const chave = ["demandas-central", escopo, termo, f.tipo, f.origem, f.prioridade, sla, encerradas];
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: chave,
    queryFn: () =>
      centralDemandas({
        data: {
          escopo,
          termo: termo || null,
          tipo: f.tipo !== "todos" ? f.tipo : null,
          origem: f.origem !== "todas" ? (f.origem as DemandaOrigem) : null,
          prioridade: f.prioridade !== "todas" ? (f.prioridade as DemandaPrioridade) : null,
          sla,
          status: encerradas ? ["concluida", "cancelada"] : ["aberta", "em_andamento", "aguardando"],
          encerradas_dias: encerradas ? 30 : 7,
        },
      }),
    refetchInterval: 60_000,
  });
  const { data: cfg } = useQuery({
    queryKey: ["demandas-config"],
    queryFn: () => configDemandas(),
    staleTime: 60_000,
  });
  useRealtimeInvalidate("demandas-central", [["demandas-central"]], ["demandas"]);

  const tipos = cfg?.tipos ?? [];
  const itens = useMemo(() => data?.itens ?? [], [data]);
  const trocarAba = (a: Aba) => navigate({ search: a === "minhas" ? {} : { aba: a }, replace: true });

  async function onAssumir(id: string) {
    setAssumindo(id);
    try {
      await assumir({ data: { id } });
      toast.success("Demanda assumida. Ela é sua agora.");
      qc.invalidateQueries({ queryKey: ["demandas-central"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível assumir."));
      refetch();
    } finally {
      setAssumindo(null);
    }
  }

  async function onPegar() {
    setPegando(true);
    try {
      const { id } = await pegar();
      if (!id) {
        toast.info("Nenhuma demanda sem responsável nas suas filas agora.");
        return;
      }
      toast.success("Você pegou a próxima da fila.");
      navigate({ to: "/operacional/demandas/$id", params: { id } });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível pegar a próxima."));
    } finally {
      setPegando(false);
    }
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">
      <OpHero
        icon={<Layers className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Central de demandas"
        descricao="Consultas, simulações, propostas e documentação delegadas com fila justa: cada demanda com dono, prazo e conversa."
        acoes={
          <>
            <VisoesDemandas atual="lista" />
            <Button
              variant="outline"
              className="h-10 rounded-xl bg-card/60 backdrop-blur"
              disabled={pegando}
              onClick={onPegar}
            >
              <Hand className="mr-1.5 h-4 w-4" /> Pegar a próxima
            </Button>
            {podeCriar && <NovaDemandaDialog onCriada={() => qc.invalidateQueries({ queryKey: ["demandas-central"] })} />}
          </>
        }
      />

      {data?.estou_ausente && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[12.5px] text-foreground">
          <CalendarOff className="size-4 text-warning" />
          Você está marcado como ausente: a fila não manda demandas novas para você. Ajuste em “Filas e prazos”.
        </div>
      )}

      <IndicadoresDemandas c={data} onSla={aba === "config" ? undefined : setSla} slaAtual={sla} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AbasEscopo atual={aba} onTrocar={trocarAba} contadores={data?.contadores} config />
        {aba !== "config" && (
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={encerradas}
                onChange={(e) => setEncerradas(e.target.checked)}
              />
              Encerradas (30 dias)
            </label>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              onClick={() => refetch()}
              aria-label="Atualizar"
              title="Atualizar"
            >
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        )}
      </div>

      {aba === "config" ? (
        <ConfigDemandasView />
      ) : (
        <>
          <FaixaFiltros f={f} onF={setF} tipos={tipos} />
          {sla && (
            <p className="text-[12px] text-muted-foreground">
              Mostrando só {sla === "atrasadas" ? "as atrasadas" : "as que vencem em 4 horas"}.{" "}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSla(null)}>
                Limpar
              </button>
            </p>
          )}
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
              ))}
            </div>
          ) : isError ? (
            <VazioDemandas
              titulo="Não foi possível carregar as demandas"
              texto={mensagemDeErro(error, "Tente de novo em instantes.")}
              acao={<Button onClick={() => refetch()}>Tentar de novo</Button>}
            />
          ) : itens.length === 0 ? (
            <VazioDemandas
              titulo={
                aba === "sem_responsavel"
                  ? "Nenhuma demanda esperando na fila"
                  : aba === "minhas"
                    ? encerradas
                      ? "Nada encerrado por aqui"
                      : "Você está em dia"
                    : "Nenhuma demanda encontrada"
              }
              texto={
                aba === "minhas" && !encerradas
                  ? "Nenhuma demanda aberta com você. Pegue a próxima da fila ou crie uma nova."
                  : "Ajuste os filtros ou troque a aba para ver outras demandas."
              }
              acao={
                aba === "minhas" && !encerradas ? (
                  <Button variant="outline" onClick={onPegar} disabled={pegando}>
                    <Hand className="mr-1.5 size-4" /> Pegar a próxima
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((d) => (
                <CartaoDemanda key={d.id} d={d} tipos={tipos} onAssumir={onAssumir} assumindo={assumindo === d.id} />
              ))}
            </div>
          )}
          {itens.length >= 300 && (
            <p className="text-center text-[12px] text-muted-foreground">
              Mostrando as 300 mais urgentes. Use a busca e os filtros para achar as demais.
            </p>
          )}
        </>
      )}
    </div>
  );
}
