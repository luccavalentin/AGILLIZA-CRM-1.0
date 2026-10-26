import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlarmClock,
  BookOpen,
  Gauge,
  Headset,
  Inbox,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Star,
  Timer,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  BarraFiltros,
  CabecalhoGestao,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
  formatarMinutos,
} from "@/components/plataforma/kit";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_CHAMADOS,
  PRIORIDADES_CHAMADO,
  lerMetricasSuporte,
  listarChamados,
  type Chamado,
  type PrioridadeChamado,
  type RecorteChamado,
  type StatusChamado,
} from "@/lib/plataforma/suporte.functions";
import {
  GavetaChamado,
  PainelChamado,
  PRIORIDADE_ROTULO,
  PRIORIDADE_TOM,
  STATUS_ROTULO,
  STATUS_TOM,
  prazoDoChamado,
} from "@/components/plataforma/suporte-chamado";
import { BaseConhecimento } from "@/components/plataforma/suporte-base";

type Aba = "central" | "metricas" | "base";
const ABAS: Aba[] = ["central", "metricas", "base"];

export const Route = createFileRoute("/_authenticated/plataforma/suporte")({
  head: () => ({ meta: [{ title: "Suporte aos assinantes — Gestão de sistemas — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: typeof s.aba === "string" && (ABAS as string[]).includes(s.aba) ? (s.aba as Aba) : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("saas.suporte"),
  component: Pagina,
});

function Pagina() {
  const { aba = "central" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const podeEditarBase = usePermissao("saas.suporte", "edit");
  return (
    <PaginaGestao>
      <CabecalhoGestao
        titulo="Suporte aos assinantes"
        icone={<LifeBuoy />}
        descricao="Central de atendimento das contas do Agilliza Tech: fila com prazo e prioridade, atendente, conversa com anexos, notas internas e métricas."
      />
      <Tabs value={aba} onValueChange={(v) => void navigate({ search: { aba: v as Aba }, replace: true })}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="central" className="min-h-11 gap-1.5 sm:min-h-9">
            <Inbox className="size-4" /> Central
          </TabsTrigger>
          <TabsTrigger value="metricas" className="min-h-11 gap-1.5 sm:min-h-9">
            <Gauge className="size-4" /> Métricas
          </TabsTrigger>
          <TabsTrigger value="base" className="min-h-11 gap-1.5 sm:min-h-9">
            <BookOpen className="size-4" /> Base de conhecimento
          </TabsTrigger>
        </TabsList>
        <TabsContent value="central" className="mt-4">
          <Central />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <Metricas />
        </TabsContent>
        <TabsContent value="base" className="mt-4">
          <BaseConhecimento podeEditar={podeEditarBase} />
        </TabsContent>
      </Tabs>
    </PaginaGestao>
  );
}

type FiltroStatus = "todos" | StatusChamado;

const FAIXA_PRIORIDADE: Record<PrioridadeChamado, string> = {
  baixa: "bg-border",
  normal: "bg-primary/30",
  alta: "bg-warning",
  urgente: "bg-destructive",
};

function Central() {
  const listarFn = useServerFn(listarChamados);
  const podeAtender = usePermissao("saas.suporte", "edit");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [prioridade, setPrioridade] = useState<"todas" | PrioridadeChamado>("todas");
  const [conta, setConta] = useState<string>("todas");
  const [recorte, setRecorte] = useState<RecorteChamado | null>("abertos");
  const [escolhido, setEscolhido] = useState<Chamado | null>(null);
  const [gaveta, setGaveta] = useState(false);
  const termo = useValorAssentado(busca.trim());
  // A página vale para o filtro em que foi escolhida: mudou o filtro, volta para a primeira.
  const chaveFiltro = JSON.stringify([status, prioridade, conta, recorte, termo]);
  const [paginaDe, setPaginaDe] = useState({ chave: chaveFiltro, pagina: 1 });
  const pagina = paginaDe.chave === chaveFiltro ? paginaDe.pagina : 1;

  const q = useQuery({
    queryKey: ["plataforma-suporte", "fila", status, prioridade, conta, recorte, termo, pagina],
    queryFn: () =>
      listarFn({
        data: {
          status: status === "todos" ? null : status,
          prioridade: prioridade === "todas" ? null : prioridade,
          conta: conta === "todas" ? null : conta,
          recorte,
          busca: termo || null,
          pagina,
        },
      }),
    refetchInterval: 60_000,
    placeholderData: (anterior) => anterior,
  });
  const chamados = q.data?.chamados ?? [];
  const resumo = q.data?.resumo;
  const contas = q.data?.contas ?? [];
  const porStatus = (s: StatusChamado) => resumo?.por_status.find((x) => x.status === s)?.total ?? 0;

  // O chamado mostrado é sempre o da lista mais recente (situação e atendente mudam).
  const aberto = escolhido ? (chamados.find((c) => c.id === escolhido.id) ?? escolhido) : null;
  const proximo = chamados.find((c) => !c.resolvido_em && !c.atribuido_a && c.atrasado) ??
    chamados.find((c) => !c.resolvido_em && !c.atribuido_a) ??
    null;

  const abrir = (c: Chamado) => {
    setEscolhido(c);
    // No celular e em telas médias o chamado abre na gaveta; no monitor, ao lado da fila.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches) setGaveta(true);
  };
  const alternarRecorte = (r: RecorteChamado) => setRecorte((atual) => (atual === r ? null : r));

  return (
    <div className="space-y-4">
      <FaixaIndicadores>
        <Indicador
          rotulo="Em aberto"
          valor={resumo?.abertos ?? 0}
          icone={<Inbox />}
          carregando={q.isLoading}
          onClick={() => alternarRecorte("abertos")}
          ativo={recorte === "abertos"}
        />
        <Indicador
          rotulo="Fora do prazo"
          valor={resumo?.atrasados ?? 0}
          icone={<AlarmClock />}
          tom={(resumo?.atrasados ?? 0) > 0 ? "perigo" : "sucesso"}
          carregando={q.isLoading}
          onClick={() => alternarRecorte("atrasados")}
          ativo={recorte === "atrasados"}
        />
        <Indicador
          rotulo="Sem atendente"
          valor={resumo?.sem_responsavel ?? 0}
          icone={<UserX />}
          tom={(resumo?.sem_responsavel ?? 0) > 0 ? "alerta" : "neutro"}
          carregando={q.isLoading}
          onClick={() => alternarRecorte("sem-responsavel")}
          ativo={recorte === "sem-responsavel"}
        />
        <Indicador
          rotulo="Avaliação média"
          valor={resumo?.media != null ? `${resumo.media.toFixed(1)} / 5` : "—"}
          detalhe={`${resumo?.avaliacoes ?? 0} avaliação(ões)`}
          icone={<Star />}
          carregando={q.isLoading}
          onClick={() => alternarRecorte("avaliados")}
          ativo={recorte === "avaliados"}
        />
      </FaixaIndicadores>

      <BarraFiltros>
        <CampoBusca valor={busca} onChange={setBusca} rotulo="Buscar chamado" placeholder="Assunto, código ou conta" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
            <SelectTrigger className="h-10 sm:w-40" aria-label="Prioridade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda prioridade</SelectItem>
              {PRIORIDADES_CHAMADO.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORIDADE_ROTULO[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger className="h-10 sm:w-52" aria-label="Conta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div data-tour="plataforma-suporte-atender" className="flex gap-2 md:ml-auto">
          {podeAtender && (
            <Button
              variant="outline"
              size="sm"
              className={cn("min-h-11 sm:min-h-9", recorte === "meus" && "border-primary text-primary")}
              onClick={() => alternarRecorte("meus")}
              aria-pressed={recorte === "meus"}
            >
              <UserCheck className="mr-1.5 size-4" /> Meus
            </Button>
          )}
          {proximo && (
            <Button size="sm" className="min-h-11 sm:min-h-9" onClick={() => abrir(proximo)}>
              <Headset className="mr-1.5 size-4" /> Atender o próximo
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            aria-label="Atualizar a fila"
          >
            <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
          </Button>
        </div>
      </BarraFiltros>

      <ChipsFiltro<FiltroStatus>
        rotulo="Situação"
        valor={status}
        onChange={setStatus}
        opcoes={[
          { valor: "todos", rotulo: "Todas", contagem: resumo?.total ?? null },
          { valor: "aberto", rotulo: STATUS_ROTULO.aberto, contagem: porStatus("aberto") },
          { valor: "em_atendimento", rotulo: STATUS_ROTULO.em_atendimento, contagem: porStatus("em_atendimento") },
          {
            valor: "aguardando_cliente",
            rotulo: STATUS_ROTULO.aguardando_cliente,
            contagem: porStatus("aguardando_cliente"),
          },
          { valor: "resolvido", rotulo: STATUS_ROTULO.resolvido, contagem: porStatus("resolvido") },
          { valor: "fechado", rotulo: STATUS_ROTULO.fechado, contagem: porStatus("fechado") },
        ]}
      />

      <div data-tour="plataforma-suporte-fila" className="grid min-w-0 gap-4 xl:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
        <Secao semRespiro className="min-w-0 self-start">
          {q.isLoading && <ListaCarregando linhas={6} />}
          {q.isError && (
            <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível carregar a fila.")} onTentar={() => q.refetch()} />
          )}
          {!q.isLoading && !q.isError && chamados.length === 0 && (
            <EstadoVazio
              icone={<LifeBuoy />}
              titulo={recorte || status !== "todos" || termo ? "Nenhum chamado neste recorte" : "Fila vazia"}
              descricao="Quando uma conta pedir ajuda, o chamado aparece aqui com o prazo do plano dela."
            />
          )}
          <ul className="divide-y divide-border/60">
            {chamados.map((c) => {
              const prazo = prazoDoChamado(c);
              const ativo = aberto?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c)}
                    aria-current={ativo ? "true" : undefined}
                    className={cn(
                      "relative flex w-full gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-primary/[0.03]",
                      ativo && "bg-primary/[0.05]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r", FAIXA_PRIORIDADE[c.prioridade])}
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{c.codigo}</span>
                        <Selo tom={STATUS_TOM[c.status]} ponto={c.status === "em_atendimento"} className="text-[11px]">
                          {STATUS_ROTULO[c.status]}
                        </Selo>
                        {c.prioridade !== "normal" && c.prioridade !== "baixa" && (
                          <Selo tom={PRIORIDADE_TOM[c.prioridade]} className="text-[11px]">
                            {PRIORIDADE_ROTULO[c.prioridade]}
                          </Selo>
                        )}
                      </span>
                      <span className="block truncate text-sm font-medium text-foreground">{c.assunto}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.conta ?? "Sem conta"} · {c.autor ?? "—"}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            prazo.tom === "perigo" ? "text-destructive" : prazo.tom === "alerta" ? "text-warning-foreground" : "text-muted-foreground",
                          )}
                        >
                          <Timer className="size-3" /> {prazo.texto}
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="size-3" /> {c.mensagens}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {c.responsavel ? (
                        <Avatar nome={c.responsavel} tamanho="sm" />
                      ) : (
                        <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          fila
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <RodapePaginas
            pagina={pagina}
            porPagina={POR_PAGINA_CHAMADOS}
            quantidade={chamados.length}
            total={q.data?.totalFiltro}
            carregando={q.isFetching}
            onPagina={(p) => setPaginaDe({ chave: chaveFiltro, pagina: p })}
          />
        </Secao>

        <div className="hidden min-w-0 xl:block">
          {aberto ? (
            <Secao semRespiro className="overflow-hidden xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
              <PainelChamado chamado={aberto} podeAtender={podeAtender} />
            </Secao>
          ) : (
            <Secao>
              <EstadoVazio
                icone={<Headset />}
                titulo="Escolha um chamado da fila"
                descricao="A conversa, o prazo e o atendimento do chamado aparecem aqui."
              />
            </Secao>
          )}
        </div>
      </div>

      <GavetaChamado chamado={gaveta ? aberto : null} podeAtender={podeAtender} onFechar={() => setGaveta(false)} />
    </div>
  );
}

type Periodo = 7 | 30 | 90;

function Metricas() {
  const metricasFn = useServerFn(lerMetricasSuporte);
  const [dias, setDias] = useState<Periodo>(30);
  const q = useQuery({
    queryKey: ["plataforma-suporte", "metricas", dias],
    queryFn: () => metricasFn({ data: { dias } }),
    staleTime: 60_000,
    placeholderData: (a) => a,
  });
  const m = q.data;
  const maxDia = Math.max(1, ...(m?.por_dia ?? []).map((d) => Math.max(d.criados, d.resolvidos)));
  const fila = m?.fila_por_prioridade ?? {};
  const totalFila = Object.values(fila).reduce((s, n) => s + Number(n ?? 0), 0);

  if (q.isError) {
    return <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível calcular as métricas.")} onTentar={() => q.refetch()} />;
  }
  return (
    <div className="space-y-4">
      <ChipsFiltro<`${Periodo}`>
        rotulo="Período"
        valor={`${dias}`}
        onChange={(v) => setDias(Number(v) as Periodo)}
        opcoes={[
          { valor: "7", rotulo: "7 dias" },
          { valor: "30", rotulo: "30 dias" },
          { valor: "90", rotulo: "90 dias" },
        ]}
      />
      <FaixaIndicadores>
        <Indicador
          rotulo="Primeira resposta (média)"
          valor={formatarMinutos(m?.primeira_resposta_media_min)}
          detalhe={`Mediana ${formatarMinutos(m?.primeira_resposta_mediana_min)}`}
          icone={<Timer />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Resolução (média)"
          valor={formatarMinutos(m?.resolucao_media_min)}
          detalhe={`${m?.resolvidos ?? 0} resolvido(s) de ${m?.criados ?? 0} recebido(s)`}
          icone={<UserCheck />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Prazo cumprido"
          valor={m?.prazo_cumprido_pct != null ? `${m.prazo_cumprido_pct}%` : "—"}
          tom={m?.prazo_cumprido_pct != null && m.prazo_cumprido_pct < 80 ? "alerta" : "sucesso"}
          detalhe="Resolvidos dentro do prazo do plano"
          icone={<AlarmClock />}
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Sem nenhuma resposta"
          valor={m?.sem_resposta ?? 0}
          tom={(m?.sem_resposta ?? 0) > 0 ? "perigo" : "sucesso"}
          detalhe={m?.avaliacao_media != null ? `Avaliação média ${m.avaliacao_media}` : "Sem avaliação no período"}
          icone={<UserX />}
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Secao titulo="Recebidos e resolvidos por dia" descricao={`Últimos ${Math.min(dias, 60)} dias`}>
          {q.isLoading ? (
            <ListaCarregando linhas={2} />
          ) : (
            <>
              <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Chamados recebidos e resolvidos por dia">
                {(m?.por_dia ?? []).map((d) => (
                  <div key={d.dia} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`${d.dia}: ${d.criados} recebido(s), ${d.resolvidos} resolvido(s)`}>
                    <span className="w-1/2 rounded-t-sm bg-primary/70" style={{ height: `${(d.criados / maxDia) * 100}%` }} />
                    <span className="w-1/2 rounded-t-sm bg-success/70" style={{ height: `${(d.resolvidos / maxDia) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-primary/70" /> Recebidos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-success/70" /> Resolvidos
                </span>
              </div>
            </>
          )}
        </Secao>
        <Secao titulo="Fila aberta agora" descricao={`${totalFila} chamado(s)`}>
          <ul className="space-y-2.5">
            {(["urgente", "alta", "normal", "baixa"] as PrioridadeChamado[]).map((p) => {
              const n = Number(fila[p] ?? 0);
              return (
                <li key={p} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Selo tom={PRIORIDADE_TOM[p]}>{PRIORIDADE_ROTULO[p]}</Selo>
                    <span className="tabular-nums">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={cn("h-full rounded-full", FAIXA_PRIORIDADE[p])} style={{ width: `${totalFila ? (n / totalFila) * 100 : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Secao>
      </div>

      <Secao titulo="Por atendente" descricao="Fila aberta e resolvidos no período" semRespiro>
        {m && m.por_atendente.length === 0 ? (
          <EstadoVazio icone={<UserCheck />} titulo="Nenhum chamado atribuído" />
        ) : (
          <ul className="divide-y divide-border/60">
            {(m?.por_atendente ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar nome={a.nome} tamanho="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{a.nome}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium tabular-nums text-foreground">{a.abertos}</span> aberto(s) ·{" "}
                  <span className="font-medium tabular-nums text-foreground">{a.resolvidos}</span> resolvido(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
