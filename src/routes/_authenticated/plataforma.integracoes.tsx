import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Cable,
  Clock,
  Code,
  Inbox,
  KeySquare,
  Layers,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CabecalhoGestao,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { MarcaProvedor, nomeDoProvedor } from "@/components/plataforma/provedores/marca-provedor";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import { CATALOGO, type ProvedorConhecido } from "@/lib/plataforma/provedores-catalogo";
import {
  alternarJobPlataforma,
  lerIntegracoes,
  reprocessarMortas,
  PROVEDORES_DO_CREDITO,
  type CredencialSituacao,
  type JobPlataforma,
  type LinhaLog,
  type MensagemFila,
  type ProvedorChamadas,
  type ResumoFila,
  type StatusFila,
} from "@/lib/plataforma/integracoes.functions";

export const Route = createFileRoute("/_authenticated/plataforma/integracoes")({
  head: () => ({ meta: [{ title: "Integrações e filas — Configurações gerais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.integracoes"),
  component: Pagina,
});

const QK = "plataforma-integracoes";
const TODAS = "todas";

const STATUS: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Pendente", tom: "info" },
  processando: { rotulo: "Processando", tom: "marca" },
  erro: { rotulo: "Com erro", tom: "alerta" },
  morto: { rotulo: "Morta", tom: "perigo" },
  concluido: { rotulo: "Concluída", tom: "sucesso" },
};

/* Provedores: nome e para que serve (mesmos textos da Gestão). */
const PROVEDOR: Record<string, { nome: string; desc: string }> = {
  homefin: { nome: "Integração bancária", desc: "Simulação e proposta nos bancos" },
  "biro-credito": {
    nome: "Birôs de crédito",
    desc: "Consulta Ficha na Serasa, no SPC e na Boa Vista",
  },
  apifull: { nome: "APIFull", desc: "Consulta Serasa Premium vendida às licenças" },
  asaas: { nome: "Asaas", desc: "Pix, boleto e cartão da plataforma e do aluguel" },
  portais: { nome: "Portais imobiliários", desc: "Carga de anúncios e retorno de leads" },
  bcb: { nome: "Banco Central", desc: "Selic, IGP-M, IPCA, INCC, INPC e TR" },
  cep: { nome: "CEP", desc: "Endereço no cadastro" },
  cnpj: { nome: "CNPJ", desc: "Dados de empresa no cadastro" },
  email: { nome: "E-mail", desc: "Convites, faturas e avisos" },
  sms: { nome: "SMS", desc: "Códigos e avisos por mensagem" },
  push: { nome: "Notificação push", desc: "Avisos no celular" },
  ia: { nome: "Inteligência artificial", desc: "Leitura de documentos e textos" },
  r2: { nome: "Armazenamento", desc: "Fotos e documentos" },
  google: { nome: "Google", desc: "Agenda e login" },
};
const nomeChamada = (p: string) => PROVEDOR[p]?.nome ?? nomeDoProvedor(p);

/**
 * O fornecedor da integração bancária nunca aparece na tela (regra do dono): tipo de
 * mensagem, erro, endereço e conteúdo passam por aqui antes de serem desenhados.
 */
function semFornecedor(texto: string | null | undefined): string {
  return (texto ?? "").replace(/home\s*fin/gi, "integracao-bancaria");
}

/** "há 3 min" / "em 5 min" a partir de um instante ISO (relógio do navegador). */
function relativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  const abs = Math.abs(min);
  const txt =
    abs < 1
      ? null
      : abs < 60
        ? `${abs} min`
        : abs < 1440
          ? `${Math.round(abs / 60)} h`
          : `${Math.round(abs / 1440)} dia(s)`;
  if (!txt) return "agora";
  return min >= 0 ? `há ${txt}` : `em ${txt}`;
}

function tempo(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000
    ? `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`
    : `${Math.round(ms)} ms`;
}

function Pagina() {
  const lerFn = useServerFn(lerIntegracoes);
  const [status, setStatus] = useState<StatusFila | null>(null);
  const [faixa, setFaixa] = useState<string | null>(null);
  const [aba, setAba] = useState("filas");
  const q = useQuery({
    queryKey: [QK, status, faixa],
    queryFn: () => lerFn({ data: { status, faixa } }),
    refetchInterval: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const d = q.data;
  const carregando = q.isLoading && !d;
  const resumo = d?.resumo ?? [];
  const jobs = d?.jobs ?? [];
  const soma = (s: string) =>
    resumo.filter((r) => r.status === s).reduce((a, r) => a + Number(r.total), 0);
  const pendentes = soma("pendente");
  const comErro = soma("erro");
  const mortas = soma("morto");
  const jobsQuebrados = jobs.filter((j) => j.ultimo_status === "erro").length;

  const verFila = (s: StatusFila | null) => {
    setStatus(s);
    setAba("filas");
  };

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="Configurações gerais"
        icone={<Cable />}
        titulo="Integrações e filas"
        descricao="Mensagens na fila, mensagens que falharam de vez, rotinas automáticas e chamadas aos provedores. Atualiza a cada 30 segundos."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
              <Link to="/plataforma/provedores">
                <KeySquare className="mr-2 size-4" /> Chaves dos provedores
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <RefreshCw className={cn("mr-2 size-4", q.isFetching && "animate-spin")} /> Atualizar
            </Button>
          </>
        }
      />

      {q.isError && (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as integrações.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Na fila"
          valor={pendentes.toLocaleString("pt-BR")}
          detalhe="Aguardando o processador"
          icone={<Layers />}
          tom="info"
          onClick={() => verFila("pendente")}
          ativo={aba === "filas" && status === "pendente"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Com erro"
          valor={comErro.toLocaleString("pt-BR")}
          detalhe="Vão tentar de novo"
          icone={<AlertTriangle />}
          tom={comErro ? "alerta" : "neutro"}
          onClick={() => verFila("erro")}
          ativo={aba === "filas" && status === "erro"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Mortas"
          valor={mortas.toLocaleString("pt-BR")}
          detalhe="Esgotaram as tentativas"
          icone={<XCircle />}
          tom={mortas ? "perigo" : "neutro"}
          onClick={() => verFila("morto")}
          ativo={aba === "filas" && status === "morto"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Rotinas com falha"
          valor={jobsQuebrados}
          detalhe={`${jobs.filter((j) => j.ativo).length} rotina(s) ativa(s)`}
          icone={<Activity />}
          tom={jobsQuebrados ? "perigo" : "neutro"}
          onClick={() => setAba("rotinas")}
          ativo={aba === "rotinas"}
          carregando={carregando}
        />
      </FaixaIndicadores>

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="filas" className="min-h-11 sm:min-h-8">
              Filas
            </TabsTrigger>
            <TabsTrigger value="chamadas" className="min-h-11 sm:min-h-8">
              Chamadas aos provedores
            </TabsTrigger>
            <TabsTrigger value="rotinas" className="min-h-11 sm:min-h-8">
              Rotinas
            </TabsTrigger>
            <TabsTrigger value="credito" className="min-h-11 sm:min-h-8">
              Integrações de crédito
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="filas" className="space-y-4">
          <Filas
            resumo={resumo}
            mensagens={d?.mensagens ?? []}
            jobs={jobs}
            podeReprocessarNoBanco={Boolean(d?.podeReprocessar)}
            status={status}
            onStatus={setStatus}
            faixa={faixa}
            onFaixa={setFaixa}
            carregando={carregando}
          />
        </TabsContent>

        <TabsContent value="chamadas" className="space-y-4">
          <Provedores provedores={d?.provedores ?? []} carregando={carregando} />
          <Log linhas={d?.log ?? []} carregando={carregando} />
        </TabsContent>

        <TabsContent value="rotinas">
          <Rotinas jobs={jobs} carregando={carregando} />
        </TabsContent>

        <TabsContent value="credito">
          <Credito
            credenciais={d?.credenciais ?? []}
            provedores={d?.provedores ?? []}
            ambiente={d?.ambiente}
            carregando={carregando}
          />
        </TabsContent>
      </Tabs>
    </PaginaGestao>
  );
}

/* ───────────────────────── Filas ───────────────────────── */

function Filas({
  resumo,
  mensagens,
  jobs,
  podeReprocessarNoBanco,
  status,
  onStatus,
  faixa,
  onFaixa,
  carregando,
}: {
  resumo: ResumoFila[];
  mensagens: MensagemFila[];
  jobs: JobPlataforma[];
  podeReprocessarNoBanco: boolean;
  status: StatusFila | null;
  onStatus: (s: StatusFila | null) => void;
  faixa: string | null;
  onFaixa: (f: string | null) => void;
  carregando: boolean;
}) {
  const podeReprocessar = usePermissao("saas.integracoes", "edit") && podeReprocessarNoBanco;
  const qc = useQueryClient();
  const reprocessarFn = useServerFn(reprocessarMortas);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const reprocessar = useMutation({
    mutationFn: () => reprocessarFn({ data: { ids: [...marcadas] } }),
    onSuccess: (r) => {
      toast.success(`${r.devolvidas} mensagem(ns) devolvida(s) à fila.`);
      setMarcadas(new Set());
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reprocessar.")),
  });

  const conta = (s: string) =>
    resumo.filter((r) => r.status === s).reduce((a, r) => a + Number(r.total), 0);
  const faixas = [...new Set(resumo.map((r) => r.faixa))].sort();
  const mortasNaLista = mensagens.filter((m) => m.status === "morto");
  // Sem nenhuma rotina executada, a fila só acumula: dizer isso vale mais que "próxima tentativa".
  const semWorker =
    jobs.length > 0 &&
    jobs.every((j) => !j.ultimo_inicio) &&
    mensagens.some((m) => m.status === "pendente");

  const porFaixa = faixas
    .map((f) => {
      const de = (s: string) =>
        resumo
          .filter((r) => r.faixa === f && r.status === s)
          .reduce((a, r) => a + Number(r.total), 0);
      const antiga =
        resumo
          .filter((r) => r.faixa === f && r.mais_antiga)
          .map((r) => r.mais_antiga as string)
          .sort()[0] ?? null;
      const p = de("pendente");
      const r = de("processando");
      const e = de("erro");
      const m = de("morto");
      return { faixa: f, p, r, e, m, total: p + r + e + m, antiga };
    })
    .sort((a, b) => b.total - a.total);
  const maior = Math.max(1, ...porFaixa.map((x) => x.total));

  const alternar = (id: string) =>
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      {semWorker && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[14px] border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>Nenhum processador consumindo a fila.</b> Nenhuma rotina agendada rodou até agora
            neste ambiente. As mensagens ficam acumuladas em <b>pendente</b> até que o processo de
            fila esteja no ar — por isso nada saiu por e-mail, SMS ou webhook.
          </p>
        </div>
      )}

      <div data-tour="integracoes-filas" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Secao
          titulo="Mensagens"
          descricao="O conteúdo aparece mascarado: e-mail, telefone e documento nunca em claro."
          icone={<Inbox />}
          semRespiro
          acoes={
            podeReprocessar &&
            mortasNaLista.length > 0 && (
              <Button
                size="sm"
                className="min-h-11 sm:min-h-8"
                disabled={reprocessar.isPending || marcadas.size === 0}
                onClick={() => reprocessar.mutate()}
              >
                <RotateCw className={cn("mr-2 size-4", reprocessar.isPending && "animate-spin")} />
                Reprocessar{marcadas.size ? ` ${marcadas.size}` : ""}
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 md:flex-row md:items-center">
            <ChipsFiltro
              rotulo="Situação das mensagens"
              className="min-w-0 flex-1"
              valor={status ?? "todas"}
              onChange={(v) => onStatus(v === "todas" ? null : v)}
              opcoes={[
                { valor: "todas" as const, rotulo: "Todas" },
                { valor: "pendente" as const, rotulo: "Pendentes", contagem: conta("pendente") },
                { valor: "erro" as const, rotulo: "Com erro", contagem: conta("erro") },
                { valor: "morto" as const, rotulo: "Mortas", contagem: conta("morto"), tom: "perigo" as Tom },
              ]}
            />
            {faixas.length > 1 && (
              <Select value={faixa ?? TODAS} onValueChange={(v) => onFaixa(v === TODAS ? null : v)}>
                <SelectTrigger className="h-10 w-full md:w-48" aria-label="Faixa da fila">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as faixas</SelectItem>
                  {faixas.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {carregando ? (
            <ListaCarregando linhas={4} />
          ) : mensagens.length === 0 ? (
            <EstadoVazio titulo="Nenhuma mensagem nesta situação" descricao="A fila está em dia." />
          ) : (
            <ul className="max-h-[640px] divide-y divide-border/60 overflow-y-auto">
              {mensagens.map((m) => {
                const st = STATUS[m.status] ?? { rotulo: m.status, tom: "neutro" as Tom };
                return (
                  <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                    {podeReprocessar && m.status === "morto" && (
                      <Checkbox
                        className="mt-1"
                        checked={marcadas.has(m.id)}
                        onCheckedChange={() => alternar(m.id)}
                        aria-label={`Marcar a mensagem ${semFornecedor(m.tipo)} para reprocessar`}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="min-w-0 break-all font-mono text-xs font-medium text-foreground">
                          {semFornecedor(m.tipo)}
                        </span>
                        <Selo tom={st.tom} ponto={m.status === "processando"}>
                          {st.rotulo}
                        </Selo>
                        {m.tentativas > 0 && (
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {m.tentativas}/{m.max_tentativas} tentativa(s)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.conta ?? "sem conta"} · <span className="font-mono">{m.faixa}</span> · criada{" "}
                        {relativo(m.criado_em)}
                        {m.proximo_em && m.status !== "concluido"
                          ? new Date(m.proximo_em) <= new Date()
                            ? " · pronta para processar"
                            : ` · próxima tentativa ${relativo(m.proximo_em)}`
                          : ""}
                      </p>
                      {m.erro && (
                        <p className="break-words rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 font-mono text-[11px] text-destructive">
                          {semFornecedor(m.erro)}
                        </p>
                      )}
                      <details>
                        <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Code className="size-3.5" aria-hidden /> ver conteúdo
                        </summary>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-secondary p-2 font-mono text-[11px]">
                          {semFornecedor(JSON.stringify(m.payload, null, 2))}
                        </pre>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>

        <Secao
          titulo="Fila por faixa"
          descricao="O que ainda não foi concluído. Toque numa faixa para filtrar."
          icone={<Layers />}
        >
          {carregando ? (
            <ListaCarregando linhas={3} className="p-0" />
          ) : porFaixa.length === 0 ? (
            <EstadoVazio
              className="py-6"
              titulo="Fila vazia"
              descricao="Nada pendente, em processamento, com erro ou morto."
            />
          ) : (
            <>
              <ul className="space-y-1">
                {porFaixa.map((x) => (
                  <li key={x.faixa}>
                    <button
                      type="button"
                      onClick={() => onFaixa(faixa === x.faixa ? null : x.faixa)}
                      aria-pressed={faixa === x.faixa}
                      title={`${x.p} pendente(s), ${x.r} em processamento, ${x.e} com erro, ${x.m} morta(s)`}
                      className={cn(
                        "grid min-h-11 w-full grid-cols-[6.5rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/[0.04] sm:min-h-9",
                        faixa === x.faixa && "bg-primary/[0.06] ring-1 ring-inset ring-primary/20",
                      )}
                    >
                      <span className="truncate font-mono">{x.faixa}</span>
                      <span
                        className="flex h-2 overflow-hidden rounded-full bg-secondary"
                        style={{ width: `${Math.max(8, (x.total / maior) * 100)}%` }}
                      >
                        <i className="bg-sky-500" style={{ width: `${(x.p / x.total) * 100}%` }} />
                        <i className="bg-primary" style={{ width: `${(x.r / x.total) * 100}%` }} />
                        <i className="bg-warning" style={{ width: `${(x.e / x.total) * 100}%` }} />
                        <i className="bg-destructive" style={{ width: `${(x.m / x.total) * 100}%` }} />
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        <b className="font-medium text-foreground">{x.total}</b>
                        {x.antiga && (
                          <span className="block text-[10px] text-muted-foreground">{relativo(x.antiga)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <Legenda cor="bg-sky-500" texto="pendente" />
                <Legenda cor="bg-primary" texto="processando" />
                <Legenda cor="bg-warning" texto="com erro" />
                <Legenda cor="bg-destructive" texto="morta" />
              </div>
            </>
          )}
        </Secao>
      </div>
    </>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn("size-2 rounded-full", cor)} /> {texto}
    </span>
  );
}

/* ───────────────────── Chamadas aos provedores ───────────────────── */

function Provedores({
  provedores,
  carregando,
}: {
  provedores: ProvedorChamadas[];
  carregando: boolean;
}) {
  return (
    <Secao
      titulo="Provedores externos — 7 dias"
      descricao="Chamadas aos birôs, à integração bancária, à APIFull, ao Asaas e aos portais."
      icone={<Cable />}
    >
      {carregando ? (
        <ListaCarregando linhas={2} className="p-0" />
      ) : provedores.length === 0 ? (
        <EstadoVazio
          className="py-6"
          titulo="Nenhuma chamada em 7 dias"
          descricao="As chaves ainda não foram configuradas ou nada foi chamado."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {provedores.map((p) => {
            const info = PROVEDOR[p.provedor] ?? { nome: nomeDoProvedor(p.provedor), desc: "Provedor externo" };
            const erros = Number(p.erros);
            return (
              <li
                key={p.provedor}
                className={cn(
                  "min-w-0 space-y-3 rounded-xl border bg-background p-3.5",
                  erros ? "border-destructive/30" : "border-border/80",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <MarcaProvedor codigo={p.provedor === "biro-credito" ? "serasa" : p.provedor} tamanho="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{info.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{info.desc}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-secondary/60 py-1.5">
                    <dd className="font-mono text-sm tabular-nums text-foreground">
                      {Number(p.chamadas).toLocaleString("pt-BR")}
                    </dd>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">chamadas</dt>
                  </div>
                  <div className="rounded-md bg-secondary/60 py-1.5">
                    <dd className={cn("font-mono text-sm tabular-nums", erros ? "text-destructive" : "text-foreground")}>
                      {erros.toLocaleString("pt-BR")}
                    </dd>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">erros</dt>
                  </div>
                  <div className="rounded-md bg-secondary/60 py-1.5">
                    <dd className="font-mono text-sm tabular-nums text-foreground">{tempo(p.latencia_ms)}</dd>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">média</dt>
                  </div>
                </dl>
                <Selo tom={erros ? "perigo" : "sucesso"} ponto>
                  {erros ? `${erros} erro(s)` : "Sem erro"}
                  {p.ultima ? ` · última ${relativo(p.ultima)}` : ""}
                </Selo>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

/** Abre em "só erro" de propósito: quem chega aqui geralmente chegou porque algo falhou. */
function Log({ linhas, carregando }: { linhas: LinhaLog[]; carregando: boolean }) {
  const [soErro, setSoErro] = useState(true);
  const comErro = linhas.filter((l) => l.erro || (l.status_http ?? 0) >= 400);
  const lista = soErro ? comErro : linhas;
  return (
    <Secao
      titulo="Chamadas recentes"
      descricao="Últimas 24 horas."
      icone={<Activity />}
      semRespiro
      acoes={
        <ChipsFiltro
          rotulo="Filtro das chamadas"
          valor={soErro ? "erro" : "tudo"}
          onChange={(v) => setSoErro(v === "erro")}
          opcoes={[
            { valor: "erro", rotulo: "Só erro", contagem: comErro.length, tom: "perigo" },
            { valor: "tudo", rotulo: "Tudo", contagem: linhas.length },
          ]}
        />
      }
    >
      {carregando ? (
        <ListaCarregando linhas={3} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          titulo={soErro ? "Nenhum erro nas últimas 24 horas" : "Nenhuma chamada nas últimas 24 horas"}
          descricao={
            soErro
              ? "Em “Tudo” estão as chamadas que deram certo."
              : "Sem chave configurada, nada sai daqui."
          }
        />
      ) : (
        <ul className="max-h-[560px] divide-y divide-border/60 overflow-y-auto">
          {lista.map((l) => {
            const erro = Boolean(l.erro || (l.status_http != null && l.status_http >= 400));
            return (
              <li key={l.id} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "mt-0.5 inline-flex min-w-[3.25rem] shrink-0 justify-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                    erro
                      ? "border-destructive/25 bg-destructive/[0.08] text-destructive"
                      : l.status_http != null
                        ? "border-success/25 bg-success/10 text-success-texto"
                        : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {l.status_http ?? (l.erro ? "falhou" : "—")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-medium text-foreground">{nomeChamada(l.provedor)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {" "}
                      {l.metodo ?? ""} {semFornecedor(l.endpoint)}
                    </span>
                  </span>
                  {l.erro && (
                    <span className="block break-words text-xs text-destructive">{semFornecedor(l.erro)}</span>
                  )}
                </span>
                <span className="shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {l.duracao_ms != null ? `${l.duracao_ms} ms` : "—"}
                  <span className="block font-sans">{relativo(l.criado_em)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

/* ───────────────────────── Rotinas ───────────────────────── */

function Rotinas({ jobs, carregando }: { jobs: JobPlataforma[]; carregando: boolean }) {
  const podeEditar = usePermissao("saas.integracoes", "edit");
  return (
    <Secao
      titulo={`Rotinas agendadas (${jobs.length})`}
      descricao="Rotinas que rodam sozinhas: partições, retenção, lembretes, reajustes, cobranças e saúde das contas."
      icone={<Clock />}
      semRespiro
    >
      {carregando ? (
        <ListaCarregando linhas={4} />
      ) : jobs.length === 0 ? (
        <EstadoVazio titulo="Nenhuma rotina agendada neste ambiente" />
      ) : (
        <ul className="divide-y divide-border/60">
          {jobs.map((j) => (
            <LinhaRotina key={j.nome} j={j} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </Secao>
  );
}

function LinhaRotina({ j, podeEditar }: { j: JobPlataforma; podeEditar: boolean }) {
  const qc = useQueryClient();
  const alternarFn = useServerFn(alternarJobPlataforma);
  const alternar = useMutation({
    mutationFn: (ativo: boolean) => alternarFn({ data: { nome: j.nome, ativo } }),
    onSuccess: (_r, ativo) => {
      toast.success(`Rotina ${j.nome} ${ativo ? "ligada" : "desligada"}.`);
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível alterar a rotina.")),
  });
  const erro = j.ultimo_status === "erro";
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 break-all font-mono text-xs font-medium text-foreground">{j.nome}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {j.cron}
          </span>
          {!j.ativo && <Selo tom="neutro">Desligada</Selo>}
          {j.ultimo_status &&
            (erro ? (
              <Selo tom="perigo">Erro</Selo>
            ) : (
              <Selo tom="sucesso">{j.ultimo_status === "sucesso" ? "OK" : j.ultimo_status}</Selo>
            ))}
        </p>
        {j.descricao && <p className="text-xs text-muted-foreground">{j.descricao}</p>}
        <p className="text-xs text-muted-foreground">
          {j.ultimo_inicio ? `Última execução ${relativo(j.ultimo_inicio)}` : "Nunca executada"}
          {j.proxima_execucao ? ` · próxima ${relativo(j.proxima_execucao)}` : ""}
        </p>
        {j.ultimo_erro && (
          <p className="break-words rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 font-mono text-[11px] text-destructive">
            {semFornecedor(j.ultimo_erro)}
          </p>
        )}
      </div>
      {podeEditar ? (
        <Switch
          className="mt-0.5 shrink-0"
          checked={j.ativo}
          disabled={alternar.isPending}
          onCheckedChange={(v) => alternar.mutate(v)}
          aria-label={j.ativo ? `Desligar a rotina ${j.nome}` : `Ligar a rotina ${j.nome}`}
        />
      ) : null}
    </li>
  );
}

/* ───────────────────── Integrações de crédito ───────────────────── */

/** "secretId" → "…a1b2": as dicas guardadas (só os últimos caracteres, nunca o valor). */
function dicasEmTexto(dicas: CredencialSituacao["dicas"]): string[] {
  if (!dicas || typeof dicas !== "object" || Array.isArray(dicas)) return [];
  return Object.entries(dicas)
    .filter(([, v]) => typeof v === "string" && v)
    .map(([k, v]) => `${k}: ${String(v)}`);
}

function Credito({
  credenciais,
  provedores,
  ambiente,
  carregando,
}: {
  credenciais: CredencialSituacao[];
  provedores: ProvedorChamadas[];
  ambiente: string | undefined;
  carregando: boolean;
}) {
  // A integração bancária aparece no log pelo código interno; os birôs, como "biro-credito".
  const chamadasDe = (p: string) =>
    provedores.find(
      (x) =>
        x.provedor === p ||
        (x.provedor === "biro-credito" && (p === "serasa" || p === "spc" || p === "boavista")),
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[14px] border border-primary/15 bg-primary/[0.04] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            A integração bancária, que leva as propostas aos bancos, e os birôs de consulta.
            Ambiente: <b>{ambiente === "producao" ? "Produção" : "Homologação"}</b>. As chaves ficam
            cifradas no banco e são cadastradas em “Chaves dos provedores”.
          </span>
        </p>
        <Button asChild size="sm" variant="outline" className="min-h-11 shrink-0 sm:min-h-8">
          <Link to="/plataforma/provedores">
            <KeySquare className="mr-2 size-4" /> Gerenciar chaves
          </Link>
        </Button>
      </div>

      {carregando ? (
        <Secao>
          <ListaCarregando linhas={3} className="p-0" />
        </Secao>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {PROVEDORES_DO_CREDITO.map((p) => {
            const cat = CATALOGO[p as ProvedorConhecido];
            const c = credenciais.find((x) => x.provedor === p) ?? null;
            const ch = chamadasDe(p);
            const dicas = c ? dicasEmTexto(c.dicas) : [];
            return (
              <li
                key={p}
                className="min-w-0 space-y-3 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]"
              >
                <div className="flex items-start gap-3">
                  <MarcaProvedor codigo={p} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-foreground">{cat?.rotulo ?? nomeDoProvedor(p)}</p>
                      {!c ? (
                        <Selo tom="neutro">Sem chave</Selo>
                      ) : c.ativo ? (
                        <Selo tom="sucesso" ponto>
                          Ligada
                        </Selo>
                      ) : (
                        <Selo tom="alerta">Desligada</Selo>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{cat?.descricao}</p>
                  </div>
                </div>
                {c && (
                  <dl className="space-y-1 rounded-lg bg-secondary/60 px-3 py-2 text-xs">
                    {dicas.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">Chaves</dt>
                        <dd className="min-w-0 break-all font-mono">{dicas.join(" · ")}</dd>
                      </div>
                    )}
                    {c.base_url && (
                      <div className="flex flex-wrap gap-x-3">
                        <dt className="text-muted-foreground">Endereço</dt>
                        <dd className="min-w-0 break-all font-mono">{semFornecedor(c.base_url)}</dd>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3">
                      <dt className="text-muted-foreground">Atualizada</dt>
                      <dd>
                        {formatData(c.atualizado_em)}
                        {c.atualizado_por ? ` por ${c.atualizado_por}` : ""}
                      </dd>
                    </div>
                    {c.observacao && (
                      <div className="flex flex-wrap gap-x-3">
                        <dt className="text-muted-foreground">Observação</dt>
                        <dd className="min-w-0 break-words">{c.observacao}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className="text-xs text-muted-foreground">
                  {ch
                    ? `${Number(ch.chamadas).toLocaleString("pt-BR")} chamada(s) em 7 dias · ${Number(ch.erros)} erro(s)${ch.ultima ? ` · última ${relativo(ch.ultima)}` : ""}`
                    : "Nenhuma chamada registrada em 7 dias."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
