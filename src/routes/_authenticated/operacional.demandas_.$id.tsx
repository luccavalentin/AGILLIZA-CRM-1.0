import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCheck,
  ExternalLink,
  Hand,
  History,
  Hourglass,
  Maximize2,
  MessageCircle,
  Paperclip,
  Play,
  RotateCcw,
  UserPlus,
  XCircle,
} from "lucide-react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { obterDemanda } from "@/lib/operacional/demandas.functions";
import {
  assumirDemanda,
  configDemandas,
  mudarStatusDemanda,
} from "@/lib/operacional/demandas-central.functions";
import {
  nomeTipoDemanda,
  proximosStatus,
  ROTULO_MOTIVO_ATRIBUICAO,
  ROTULO_PRIORIDADE_DEMANDA,
  ROTULO_STATUS_DEMANDA,
  type DemandaOrigem,
  type DemandaPrioridade,
  type DemandaStatus,
} from "@/lib/operacional/demandas-regras";
import { DemandaChatTab } from "@/components/operacional/demanda-chat";
import { abrirDemandaChatFlutuante } from "@/components/shared/floating-chat-store";
import { AdicionarParticipanteDialog } from "@/components/operacional/adicionar-participante-dialog";
import { OpAvatar } from "@/components/operacional/ui";
import { ReatribuirDialog } from "@/components/demandas/reatribuir-dialog";
import { MotivoDialog } from "@/components/demandas/barra-demandas";
import { ArquivosDemanda, HistoricoDemanda } from "@/components/demandas/detalhe-abas";
import {
  BarraPrazo,
  OrigemChip,
  PrazoChip,
  PrioridadeMarca,
  StatusDemandaChip,
  TipoIcone,
  VazioDemandas,
} from "@/components/demandas/pecas";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

type Aba = "conversa" | "arquivos" | "historico";

const ACAO_STATUS: Record<DemandaStatus, { rotulo: string; icone: React.ReactNode }> = {
  aberta: { rotulo: "Reabrir", icone: <RotateCcw className="size-4" /> },
  em_andamento: { rotulo: "Em andamento", icone: <Play className="size-4" /> },
  aguardando: { rotulo: "Aguardar solicitante", icone: <Hourglass className="size-4" /> },
  concluida: { rotulo: "Concluir", icone: <CheckCheck className="size-4" /> },
  cancelada: { rotulo: "Cancelar", icone: <XCircle className="size-4" /> },
};

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2 py-2 text-[12.5px]">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("conversa");
  const [reatribuir, setReatribuir] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mover = useServerFn(mudarStatusDemanda);
  const assumir = useServerFn(assumirDemanda);
  const podeEncerrar = usePermissao("operacional.demandas", "encerrar" as never);
  const podeTransferir = usePermissao("operacional.demandas", "transferir" as never);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });
  const { data: cfg } = useQuery({
    queryKey: ["demandas-config"],
    queryFn: () => configDemandas(),
    staleTime: 60_000,
  });

  const d = (data?.demanda ?? null) as Record<string, any> | null;
  const status = (d?.status ?? "aberta") as DemandaStatus;
  const nomeFila = useMemo(() => cfg?.filas.find((f) => f.id === d?.fila_id)?.nome ?? null, [cfg, d]);
  const proximos = proximosStatus(status).filter((s) => (s === "concluida" || s === "cancelada" ? podeEncerrar : true));
  const pode = data?.permissoes;
  const podeReatribuir = !!cfg?.pode_gerir || (!!(pode?.sou_responsavel || pode?.sou_criador) && podeTransferir);

  function atualizar() {
    refetch();
    qc.invalidateQueries({ queryKey: ["demandas-central"] });
  }

  async function trocar(para: DemandaStatus) {
    if (para === "cancelada") {
      setCancelar(true);
      return;
    }
    setOcupado(true);
    try {
      await mover({ data: { id, status: para } });
      toast.success(`Situação: ${ROTULO_STATUS_DEMANDA[para]}.`);
      atualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível mudar a situação."));
    } finally {
      setOcupado(false);
    }
  }

  async function onAssumir() {
    setOcupado(true);
    try {
      await assumir({ data: { id } });
      toast.success("Demanda assumida. Ela é sua agora.");
      atualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível assumir."));
      refetch();
    } finally {
      setOcupado(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 p-3 sm:p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-[70vh] animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }
  if (isError || !d) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <VazioDemandas
          titulo="Demanda não encontrada"
          texto={isError ? mensagemDeErro(error, "Tente de novo.") : "Ela pode ter sido excluída ou você não tem acesso a ela."}
          acao={
            <Button asChild variant="outline">
              <Link to="/operacional/demandas">Voltar à central</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const semResponsavel = !d.responsavel_id;
  const anexos = (data?.anexos ?? []) as Parameters<typeof ArquivosDemanda>[0]["anexos"];
  const historico = (data?.historico ?? []) as Parameters<typeof HistoricoDemanda>[0]["historico"];
  const participantes = (data?.participantes ?? []) as { user_id: string; nome: string | null }[];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link to="/operacional/demandas" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Central de demandas
        </Link>
        <span aria-hidden>/</span>
        <span className="tabular-nums">{d.numero}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-4">
          <header className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_0_color-mix(in_oklab,#fff_70%,transparent)_inset,0_18px_40px_-30px_rgba(0,15,159,0.45)] md:p-5">
            <div className="flex items-start gap-3">
              <TipoIcone tipo={d.tipo} className="size-11 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground/80">{d.numero}</span>
                  <span aria-hidden>·</span>
                  <span>{nomeTipoDemanda(d.tipo, cfg?.tipos)}</span>
                  <PrioridadeMarca prioridade={d.prioridade as DemandaPrioridade} />
                </div>
                <h1 className="mt-0.5 text-lg font-semibold leading-snug tracking-tight text-foreground md:text-xl">{d.titulo}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusDemandaChip status={status} />
                  <PrazoChip prazo={d.prazo_sla} status={status} />
                  <OrigemChip origem={(d.origem_tipo ?? "interno") as DemandaOrigem} conta={d.conta_nome} />
                </div>
              </div>
            </div>
            {d.descricao && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/90">
                {d.descricao}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {semResponsavel && status === "aberta" && (
                <Button onClick={onAssumir} disabled={ocupado} className="h-9 rounded-xl font-semibold">
                  <Hand className="mr-1.5 size-4" /> Assumir
                </Button>
              )}
              {proximos
                .filter((s) => !(semResponsavel && s === "em_andamento"))
                .map((s) => (
                  <Button
                    key={s}
                    variant={s === "concluida" ? "default" : "outline"}
                    disabled={ocupado}
                    onClick={() => trocar(s)}
                    className={cn("h-9 rounded-xl", s === "cancelada" && "text-muted-foreground hover:text-destructive")}
                  >
                    {ACAO_STATUS[s].icone}
                    <span className="ml-1.5">{ACAO_STATUS[s].rotulo}</span>
                  </Button>
                ))}
              {podeReatribuir && status !== "concluida" && status !== "cancelada" && (
                <Button variant="ghost" className="h-9 rounded-xl" onClick={() => setReatribuir(true)}>
                  <ArrowRightLeft className="mr-1.5 size-4" /> Reatribuir
                </Button>
              )}
            </div>
          </header>

          <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5">
              <div role="tablist" className="flex gap-1">
                {(
                  [
                    ["conversa", "Conversa", <MessageCircle key="c" className="size-4" />],
                    ["arquivos", `Arquivos${anexos.length ? ` (${anexos.length})` : ""}`, <Paperclip key="a" className="size-4" />],
                    ["historico", "Histórico", <History key="h" className="size-4" />],
                  ] as [Aba, string, React.ReactNode][]
                ).map(([k, rot, ic]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={aba === k}
                    type="button"
                    onClick={() => setAba(k)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition",
                      aba === k ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {ic}
                    {rot}
                  </button>
                ))}
              </div>
              {aba === "conversa" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={() =>
                    abrirDemandaChatFlutuante(id, {
                      numero: d.numero,
                      titulo: d.titulo,
                      statusLabel: ROTULO_STATUS_DEMANDA[status],
                    })
                  }
                >
                  <Maximize2 className="mr-1 size-3.5" /> Janela
                </Button>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {aba === "conversa" && (
                <DemandaChatTab
                  demandaId={id}
                  info={{ numero: d.numero, titulo: d.titulo, statusLabel: ROTULO_STATUS_DEMANDA[status] }}
                />
              )}
              {aba === "arquivos" && <ArquivosDemanda anexos={anexos} />}
              {aba === "historico" && <HistoricoDemanda historico={historico} />}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quem atende</h2>
            {semResponsavel ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-[12.5px]">
                <p className="font-semibold text-foreground">Sem responsável</p>
                <p className="mt-0.5 text-muted-foreground">
                  {nomeFila ? `Na fila ${nomeFila}, esperando alguém disponível.` : "Nenhuma fila atende este tipo e esta origem."}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <OpAvatar nome={data?.nome_responsavel} className="size-9 text-[11px]" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{data?.nome_responsavel ?? "—"}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {d.atribuicao_motivo ? ROTULO_MOTIVO_ATRIBUICAO[d.atribuicao_motivo] : "Responsável"}
                    {d.atribuida_em ? ` · ${new Date(d.atribuida_em).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 divide-y divide-border/60">
              {nomeFila && <Linha rotulo="Fila">{nomeFila}</Linha>}
              <Linha rotulo="Pedida por">
                {d.origem_tipo !== "interno" ? (d.solicitante_nome ?? "Assinante") : (data?.nome_criador ?? "—")}
              </Linha>
              {d.conta_nome && <Linha rotulo="Conta">{d.conta_nome}</Linha>}
              <Linha rotulo="Prioridade">{ROTULO_PRIORIDADE_DEMANDA[d.prioridade as DemandaPrioridade]}</Linha>
              <Linha rotulo="Prazo">
                <span className="block">{d.prazo_sla ? new Date(d.prazo_sla).toLocaleString("pt-BR") : "Sem prazo"}</span>
                <span className="mt-1 block">
                  <BarraPrazo inicio={d.sla_inicio} prazo={d.prazo_sla} status={status} />
                </span>
              </Linha>
              <Linha rotulo="Aberta em">{new Date(d.created_at).toLocaleString("pt-BR")}</Linha>
            </div>
          </div>

          {(d.cliente_id || d.proposta_id || d.simulacao_id || d.ref_tipo === "proposta_assinante") && (
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ligada a</h2>
              <div className="space-y-1.5 text-[12.5px]">
                {d.cliente_id && (
                  <Link to="/crm/clientes/$id" params={{ id: d.cliente_id }} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent">
                    <span>Cliente {d.clientes?.nome ?? ""}</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </Link>
                )}
                {d.proposta_id && (
                  <Link to="/operacional/propostas/$id" params={{ id: d.proposta_id }} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent">
                    <span>Proposta do Agilliza</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </Link>
                )}
                {d.simulacao_id && (
                  <Link to="/operacional/simulacoes/$id" params={{ id: d.simulacao_id }} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent">
                    <span>Simulação</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </Link>
                )}
                {d.ref_tipo === "proposta_assinante" && (
                  <Link
                    to="/operacional/propostas"
                    search={{ aba: "assinantes" }}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent"
                  >
                    <span>
                      Proposta {d.ref_codigo} do assinante
                      {d.ref_status ? <span className="block text-[11px] text-muted-foreground">Situação na fila: {d.ref_status.replaceAll("_", " ")}</span> : null}
                    </span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Participantes</h2>
              {(pode?.sou_criador || pode?.sou_responsavel) && (
                <AdicionarParticipanteDialog
                  demandaId={id}
                  jaParticipantes={participantes.map((p) => p.user_id)}
                  onAdicionado={atualizar}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]">
                      <UserPlus className="mr-1 size-3.5" /> Adicionar
                    </Button>
                  }
                />
              )}
            </div>
            {participantes.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Ninguém além de quem pediu e de quem atende.</p>
            ) : (
              <ul className="space-y-1.5">
                {participantes.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-2 text-[12.5px]">
                    <OpAvatar nome={p.nome} className="size-6 text-[9px]" />
                    <span className="truncate">{p.nome ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ReatribuirDialog
        demandaId={id}
        responsavelAtual={d.responsavel_id ?? null}
        aberto={reatribuir}
        onAberto={setReatribuir}
        onFeito={atualizar}
      />
      <MotivoDialog
        aberto={cancelar}
        titulo="Cancelar demanda"
        descricao="O motivo vai para o histórico e quem participa é avisado."
        rotulo="Cancelar demanda"
        onFechar={() => setCancelar(false)}
        onConfirmar={async (motivo) => {
          try {
            await mover({ data: { id, status: "cancelada", motivo } });
            toast.success("Demanda cancelada.");
            setCancelar(false);
            atualizar();
          } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível cancelar."));
          }
        }}
      />
    </div>
  );
}
