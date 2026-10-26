import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  Timer,
  Webhook,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CabecalhoGestao,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  IconeGestao,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { MarcaProvedor, nomeDoProvedor } from "@/components/plataforma/provedores/marca-provedor";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_INCIDENTES,
  agirIncidente,
  lerMonitoramento,
  type Incidente,
  type PainelTecnico,
  type RotinaPlataforma,
} from "@/lib/plataforma/monitoramento.functions";

export const Route = createFileRoute("/_authenticated/plataforma/monitoramento")({
  head: () => ({ meta: [{ title: "Monitoramento e incidentes — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.monitoramento"),
  component: Pagina,
});

const SEVERIDADE: Record<Incidente["severidade"], { rotulo: string; tom: Tom }> = {
  critica: { rotulo: "Crítica", tom: "perigo" },
  alta: { rotulo: "Alta", tom: "perigo" },
  aviso: { rotulo: "Aviso", tom: "alerta" },
  info: { rotulo: "Informação", tom: "info" },
};
const STATUS_INC: Record<Incidente["status"], { rotulo: string; tom: Tom }> = {
  aberto: { rotulo: "Aberto", tom: "perigo" },
  reconhecido: { rotulo: "Em tratamento", tom: "alerta" },
  resolvido: { rotulo: "Resolvido", tom: "sucesso" },
};

/** "há 3 min" a partir de um instante ISO (relógio do navegador). */
function ha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

type Saude = "ok" | "atencao" | "critico" | "carregando";

const SAUDE: Record<Saude, { rotulo: string; tom: Tom; ponto: string }> = {
  ok: { rotulo: "Operando", tom: "sucesso", ponto: "bg-success" },
  atencao: { rotulo: "Atenção", tom: "alerta", ponto: "bg-warning" },
  critico: { rotulo: "Crítico", tom: "perigo", ponto: "bg-destructive" },
  carregando: { rotulo: "Lendo…", tom: "neutro", ponto: "bg-muted-foreground/40" },
};

/** Ponto vivo (pulsa quando não é "ok"; parado com movimento reduzido). */
function PontoVivo({ saude, className }: { saude: Saude; className?: string }) {
  const cor = SAUDE[saude].ponto;
  return (
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden>
      {saude !== "carregando" && (
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping",
            cor,
            saude === "ok" && "motion-safe:[animation-duration:2.4s]",
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", cor)} />
    </span>
  );
}

function Pagina() {
  const lerFn = useServerFn(lerMonitoramento);
  const [status, setStatus] = useState<"todos" | Incidente["status"]>("aberto");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: ["plataforma-monitoramento", status, pagina],
    queryFn: () => lerFn({ data: { status: status === "todos" ? null : status, pagina } }),
    refetchInterval: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const p = q.data?.painel;
  const lista = q.data?.lista;
  const rotinas = p?.jobs ?? [];
  const rotinasComErro = rotinas.filter((r) => r.ultimo_status === "erro");
  const banco = p?.banco;
  const worker = p?.coletas?.worker;
  const carregando = q.isLoading;

  const workerParado =
    !worker?.coletado_em || Date.now() - new Date(worker.coletado_em).getTime() > 10 * 60_000;
  const saudeBanco: Saude = carregando
    ? "carregando"
    : (banco?.uso_pct ?? 0) >= 90
      ? "critico"
      : (banco?.uso_pct ?? 0) >= 80 || (banco?.aguardando_bloqueio ?? 0) > 0
        ? "atencao"
        : "ok";
  const saudeWorker: Saude = carregando ? "carregando" : workerParado ? "critico" : "ok";
  const saudeIntegracoes: Saude = carregando
    ? "carregando"
    : (p?.webhooks_24h?.com_erro ?? 0) > 0 ||
        (p?.propostas_erro_envio_1h ?? 0) > 0 ||
        (p?.fila?.mortas_24h ?? 0) > 0
      ? "atencao"
      : "ok";
  const saudeIncidentes: Saude = carregando
    ? "carregando"
    : (lista?.criticos ?? 0) > 0
      ? "critico"
      : (lista?.abertos ?? 0) > 0 || rotinasComErro.length > 0
        ? "atencao"
        : "ok";
  const saudes = [saudeBanco, saudeWorker, saudeIntegracoes, saudeIncidentes];
  const geral: Saude = carregando
    ? "carregando"
    : saudes.includes("critico")
      ? "critico"
      : saudes.includes("atencao")
        ? "atencao"
        : "ok";
  const pedemAtencao = saudes.filter((s) => s === "atencao" || s === "critico").length;

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={<Activity />}
        titulo="Monitoramento e incidentes"
        descricao="Central de operação do ecossistema: banco de dados, processador de tarefas, rotinas automáticas, provedores e incidentes, ao vivo."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-2 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível ler o monitoramento.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      )}

      {/* Faixa de situação geral */}
      <section
        data-tour="plataforma-monitoramento-situacao"
        aria-live="polite"
        className={cn(
          "flex flex-col gap-3 rounded-[14px] border bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)] sm:flex-row sm:items-center sm:justify-between",
          geral === "critico" && "border-destructive/30",
          geral === "atencao" && "border-warning/50",
          (geral === "ok" || geral === "carregando") && "border-border/80",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <IconeGestao
            tamanho="lg"
            tom={SAUDE[geral].tom}
            icone={geral === "ok" ? <CheckCircle2 /> : geral === "carregando" ? <Radio /> : <ShieldAlert />}
          />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">
              {geral === "carregando"
                ? "Lendo a situação do ecossistema…"
                : geral === "ok"
                  ? "Todos os sistemas operando normalmente"
                  : `${pedemAtencao} ${pedemAtencao === 1 ? "área pede" : "áreas pedem"} atenção`}
            </p>
            <p className="text-xs text-muted-foreground">
              {lista?.abertos ?? 0} incidente(s) aberto(s) · {lista?.criticos ?? 0} crítico(s) ·{" "}
              {rotinasComErro.length} rotina(s) com erro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <PontoVivo saude={q.isError ? "critico" : carregando ? "carregando" : "ok"} />
          AO VIVO · {ha(p?.gerado_em)} · a cada 30 s
        </div>
      </section>

      {/* Serviços */}
      <div data-tour="plataforma-monitoramento-servicos" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PainelServico
          titulo="Banco de dados"
          icone={<Database />}
          saude={saudeBanco}
          medidor={
            banco?.uso_pct != null
              ? { pct: banco.uso_pct, rotulo: `${banco.conexoes ?? "—"}/${banco.max_conexoes ?? "—"} conexões` }
              : undefined
          }
          linhas={[
            ["Cache", banco?.cache_hit_pct != null ? `${banco.cache_hit_pct}%` : "—"],
            ["Esperando bloqueio", String(banco?.aguardando_bloqueio ?? "—")],
            [
              "Transação mais longa",
              banco?.transacao_mais_longa_s != null ? `${banco.transacao_mais_longa_s} s` : "—",
            ],
          ]}
        />
        <PainelServico
          titulo="Processador de tarefas"
          icone={<Server />}
          saude={saudeWorker}
          linhas={[
            ["Último sinal", ha(worker?.coletado_em)],
            ["Memória", worker?.dados?.memoria_mb != null ? `${worker.dados.memoria_mb} MB` : "—"],
            ["Faixas", String(worker?.dados?.faixas?.length ?? "—")],
            ["Fila pendente", String(p?.fila?.pendentes ?? "—")],
          ]}
        />
        <PainelServico
          titulo="Integrações"
          icone={<Webhook />}
          saude={saudeIntegracoes}
          linhas={[
            [
              "Webhooks 24 h",
              `${p?.webhooks_24h?.recebidos ?? 0} · ${p?.webhooks_24h?.com_erro ?? 0} erro`,
            ],
            ["Propostas com erro (1 h)", String(p?.propostas_erro_envio_1h ?? 0)],
            ["Descartadas (24 h)", String(p?.fila?.mortas_24h ?? 0)],
            ["Consultas a conferir", String(p?.consultas_pagas?.reconciliar ?? 0)],
          ]}
        />
        <PainelServico
          titulo="Incidentes"
          icone={<AlertTriangle />}
          saude={saudeIncidentes}
          linhas={[
            ["Abertos", String(lista?.abertos ?? 0)],
            ["Críticos", String(lista?.criticos ?? 0)],
            ["Rotinas com erro", String(rotinasComErro.length)],
            ["Fila mais antiga", ha(p?.fila?.mais_antiga)],
          ]}
        />
      </div>

      {(p?.provedores_1h?.length ?? 0) > 0 && <Provedores linhas={p!.provedores_1h!} />}

      <Incidentes
        lista={lista?.incidentes ?? []}
        abertos={lista?.abertos}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPagina(1);
        }}
        carregando={carregando}
        rodape={
          <RodapePaginas
            pagina={pagina}
            porPagina={POR_PAGINA_INCIDENTES}
            quantidade={lista?.incidentes.length ?? 0}
            total={lista?.total}
            carregando={q.isFetching}
            onPagina={setPagina}
          />
        }
      />

      <Rotinas rotinas={rotinas} carregando={carregando} />
    </PaginaGestao>
  );
}

function PainelServico({
  titulo,
  icone,
  saude,
  linhas,
  medidor,
}: {
  titulo: string;
  icone: ReactNode;
  saude: Saude;
  linhas: [string, string][];
  medidor?: { pct: number; rotulo: string };
}) {
  const s = SAUDE[saude];
  return (
    <section
      className={cn(
        "min-w-0 rounded-[14px] border bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]",
        saude === "critico" ? "border-destructive/30" : saude === "atencao" ? "border-warning/50" : "border-border/80",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconeGestao icone={icone} tamanho="sm" tom={saude === "ok" ? "marca" : s.tom} />
          <h2 className="truncate text-sm font-semibold text-foreground">{titulo}</h2>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <PontoVivo saude={saude} />
          {s.rotulo}
        </span>
      </header>
      {saude === "carregando" ? (
        <Skeleton className="mt-3 h-24" />
      ) : (
        <>
          {medidor && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{medidor.rotulo}</span>
                <span className="font-mono tabular-nums text-foreground">{medidor.pct}%</span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={medidor.pct}
                aria-label="Uso das conexões"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    medidor.pct >= 90 ? "bg-destructive" : medidor.pct >= 80 ? "bg-warning" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, medidor.pct))}%` }}
                />
              </div>
            </div>
          )}
          <dl className="mt-3 space-y-1.5 text-xs">
            {linhas.map(([r, v]) => (
              <div key={r} className="flex min-w-0 items-center justify-between gap-3">
                <dt className="truncate text-muted-foreground">{r}</dt>
                <dd className="shrink-0 font-mono tabular-nums text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

function Provedores({
  linhas,
}: {
  linhas: NonNullable<PainelTecnico["provedores_1h"]>;
}) {
  return (
    <Secao titulo="Provedores na última hora" descricao="Chamadas, falhas do fornecedor, recusas e tempo de resposta (p95)." semRespiro>
      <ul className="divide-y divide-border/70">
        {linhas.map((x) => {
          const falhas = x.falhas_fornecedor + x.recusas;
          const sucesso = x.chamadas > 0 ? Math.round(((x.chamadas - falhas) / x.chamadas) * 100) : 100;
          const saude: Saude = x.falhas_fornecedor > 0 && sucesso < 90 ? "critico" : falhas > 0 ? "atencao" : "ok";
          return (
            <li key={x.provedor} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)]">
              <MarcaProvedor codigo={x.provedor} tamanho="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <PontoVivo saude={saude} /> {nomeDoProvedor(x.provedor)}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">{x.chamadas} chamadas</p>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2 text-xs md:col-span-1">
                <Metrica rotulo="Sucesso" valor={`${sucesso}%`} />
                <Metrica rotulo="Falhas / recusas" valor={`${x.falhas_fornecedor} / ${x.recusas}`} />
                <Metrica rotulo="p95" valor={x.p95_ms != null ? `${x.p95_ms} ms` : "—"} />
              </div>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-md bg-secondary/60 px-2 py-1.5">
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="font-mono tabular-nums text-foreground">{valor}</p>
    </div>
  );
}

function Incidentes({
  lista,
  abertos,
  status,
  onStatus,
  carregando,
  rodape,
}: {
  lista: Incidente[];
  abertos?: number;
  status: "todos" | Incidente["status"];
  onStatus: (s: "todos" | Incidente["status"]) => void;
  carregando: boolean;
  rodape?: ReactNode;
}) {
  const podeTratar = usePermissao("saas.monitoramento", "edit");
  return (
    <Secao
      titulo="Linha do tempo dos incidentes"
      descricao="Agrupados pela chave do problema: cada ocorrência repetida soma no mesmo incidente."
      icone={<Clock />}
      semRespiro
    >
      <div data-tour="plataforma-monitoramento-incidentes" className="border-b border-border/70 px-4 py-3">
        <ChipsFiltro
          rotulo="Situação dos incidentes"
          valor={status}
          onChange={onStatus}
          opcoes={[
            { valor: "aberto", rotulo: "Abertos", contagem: abertos ?? null, tom: "perigo" },
            { valor: "reconhecido", rotulo: "Em tratamento" },
            { valor: "resolvido", rotulo: "Resolvidos" },
            { valor: "todos", rotulo: "Todos" },
          ]}
        />
      </div>
      {carregando ? (
        <ListaCarregando linhas={3} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          icone={<CheckCircle2 />}
          titulo="Nenhum incidente nesta situação"
          descricao={status === "aberto" ? "Nada aberto agora. O painel avisa assim que algo acontecer." : undefined}
        />
      ) : (
        <ol className="relative px-4 py-2">
          <span aria-hidden className="absolute bottom-4 left-[27px] top-4 w-px bg-border" />
          {lista.map((i) => (
            <LinhaIncidente key={i.id} incidente={i} podeTratar={podeTratar} />
          ))}
        </ol>
      )}
      {rodape}
    </Secao>
  );
}

function LinhaIncidente({ incidente: i, podeTratar }: { incidente: Incidente; podeTratar: boolean }) {
  const qc = useQueryClient();
  const agirFn = useServerFn(agirIncidente);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const agir = useMutation({
    mutationFn: (acao: "reconhecer" | "resolver" | "reabrir") =>
      agirFn({ data: { id: i.id, acao, texto: texto.trim() || null } }),
    onSuccess: () => {
      toast.success("Incidente atualizado.");
      setTexto("");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["plataforma-monitoramento"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o incidente.")),
  });
  const sev = SEVERIDADE[i.severidade] ?? { rotulo: i.severidade, tom: "neutro" as Tom };
  const st = STATUS_INC[i.status];
  const corPonto =
    i.status === "resolvido"
      ? "bg-success"
      : sev.tom === "perigo"
        ? "bg-destructive"
        : sev.tom === "alerta"
          ? "bg-warning"
          : "bg-sky-500";

  return (
    <li className="relative flex gap-3 py-3">
      <span className="relative z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border">
        <span className={cn("size-2.5 rounded-full", corPonto)} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-foreground">{i.titulo}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span className="font-mono">{i.origem}</span>
              <span>· {i.categoria}</span>
              {i.conta && <span>· conta {i.conta}</span>}
              <span>
                · <Timer className="inline size-3" /> {i.ocorrencias} ocorrência(s), última {ha(i.ultima_em)}
              </span>
              {i.responsavel && <span>· com {i.responsavel}</span>}
            </p>
            {i.resolucao && (
              <p className="mt-1 rounded-md bg-success/[0.07] px-2 py-1 text-xs text-success-texto">
                Resolução: {i.resolucao}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Selo tom={sev.tom}>{sev.rotulo}</Selo>
            <Selo tom={st.tom} ponto={i.status !== "resolvido"}>
              {st.rotulo}
            </Selo>
            {podeTratar && (
              <Button
                size="sm"
                variant={aberto ? "secondary" : "ghost"}
                className="min-h-11 sm:min-h-8"
                onClick={() => setAberto((v) => !v)}
                aria-expanded={aberto}
              >
                <Workflow className="mr-1.5 size-3.5" /> Tratar
              </Button>
            )}
          </div>
        </div>
        {aberto && podeTratar && (
          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <Textarea
              aria-label="Anotação do tratamento"
              rows={2}
              className="text-base sm:text-sm"
              placeholder="O que foi verificado ou feito (obrigatório para resolver)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {i.status === "aberto" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 sm:min-h-8"
                  disabled={agir.isPending}
                  onClick={() => agir.mutate("reconhecer")}
                >
                  Assumir
                </Button>
              )}
              {i.status !== "resolvido" && (
                <Button
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  disabled={agir.isPending || texto.trim().length < 5}
                  onClick={() => agir.mutate("resolver")}
                >
                  Resolver
                </Button>
              )}
              {i.status === "resolvido" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 sm:min-h-8"
                  disabled={agir.isPending}
                  onClick={() => agir.mutate("reabrir")}
                >
                  Reabrir
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Rotinas({ rotinas, carregando }: { rotinas: RotinaPlataforma[]; carregando: boolean }) {
  const ordenadas = [...rotinas].sort(
    (a, b) => Number(b.ultimo_status === "erro") - Number(a.ultimo_status === "erro"),
  );
  const comErro = rotinas.filter((r) => r.ultimo_status === "erro").length;
  return (
    <Secao
      titulo={`Rotinas automáticas (${rotinas.length})`}
      descricao={comErro > 0 ? `${comErro} com erro na última execução` : "Todas rodaram sem erro na última execução"}
      icone={<Cpu />}
      semRespiro
    >
      {carregando ? (
        <ListaCarregando linhas={3} />
      ) : ordenadas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma rotina registrada" />
      ) : (
        <ul data-tour="plataforma-monitoramento-rotinas" className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-3">
          {ordenadas.map((r) => {
            const saude: Saude =
              r.ultimo_status === "erro" ? "critico" : r.ultimo_status === "sucesso" ? "ok" : "carregando";
            return (
              <li key={r.nome} className="min-w-0 bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2">
                    <PontoVivo saude={saude} />
                    <span className="truncate font-mono text-xs text-foreground" title={r.nome}>
                      {r.nome}
                    </span>
                  </p>
                  {r.ultimo_status === "erro" ? (
                    <Selo tom="perigo">Erro</Selo>
                  ) : r.ultimo_status === "sucesso" ? (
                    <Selo tom="sucesso">OK</Selo>
                  ) : (
                    <Selo tom="neutro">{r.ativo ? "Aguardando" : "Desligada"}</Selo>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.ultimo_fim ? `Última execução ${ha(r.ultimo_fim)}` : "Ainda não rodou"}
                </p>
                {r.ultimo_erro && (
                  <p className="mt-1 line-clamp-2 break-all font-mono text-[11px] text-destructive" title={r.ultimo_erro}>
                    {r.ultimo_erro}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}
