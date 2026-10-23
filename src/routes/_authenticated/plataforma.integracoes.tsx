import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clock,
  Code,
  Inbox,
  KeySquare,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
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
  head: () => ({ meta: [{ title: "Integrações e filas — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.integracoes"),
  component: Pagina,
});

const QK = "plataforma-integracoes";
const TODAS = "todas";

const STATUS_ROTULO: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  erro: "Com erro",
  morto: "Morta",
  concluido: "Concluída",
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
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Cable className="h-5 w-5" />}
        titulo="Integrações e filas"
        descricao="Mensagens na fila, mensagens que falharam de vez, rotinas automáticas e chamadas aos provedores. Atualiza a cada 30 segundos."
        acoes={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/plataforma/provedores">
                <KeySquare className="mr-2 size-4" /> Chaves dos provedores
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
          </>
        }
      />

      {q.isError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {mensagemDeErro(q.error, "Não foi possível carregar as integrações.")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icone={<Cable className="size-4" />}
          rotulo="Na fila"
          valor={pendentes}
          detalhe="aguardando o processador"
          tom={pendentes ? "info" : undefined}
          onClick={() => verFila("pendente")}
          carregando={carregando}
        />
        <Metrica
          icone={<AlertTriangle className="size-4" />}
          rotulo="Com erro"
          valor={comErro}
          detalhe="vão tentar de novo"
          tom={comErro ? "alerta" : undefined}
          onClick={() => verFila("erro")}
          carregando={carregando}
        />
        <Metrica
          icone={<XCircle className="size-4" />}
          rotulo="Mortas"
          valor={mortas}
          detalhe="esgotaram as tentativas"
          tom={mortas ? "perigo" : undefined}
          onClick={() => verFila("morto")}
          carregando={carregando}
        />
        <Metrica
          icone={<Activity className="size-4" />}
          rotulo="Rotinas com falha"
          valor={jobsQuebrados}
          detalhe={`${jobs.filter((j) => j.ativo).length} rotina(s) ativa(s)`}
          tom={jobsQuebrados ? "perigo" : undefined}
          onClick={() => setAba("rotinas")}
          carregando={carregando}
        />
      </div>

      <Tabs value={aba} onValueChange={setAba} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="filas">Filas</TabsTrigger>
          <TabsTrigger value="chamadas">Chamadas aos provedores</TabsTrigger>
          <TabsTrigger value="rotinas">Rotinas</TabsTrigger>
          <TabsTrigger value="credito">Integrações de crédito</TabsTrigger>
        </TabsList>

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
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  detalhe,
  tom,
  onClick,
  carregando,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  detalhe: string;
  tom?: "info" | "alerta" | "perigo";
  onClick: () => void;
  carregando: boolean;
}) {
  const cor =
    tom === "perigo"
      ? "border-destructive/50"
      : tom === "alerta"
        ? "border-amber-400/70"
        : tom === "info"
          ? "border-primary/40"
          : "border-border";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${rotulo}: ${valor}. Ver detalhes`}
      className={`min-w-0 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cor}`}
    >
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icone} {rotulo}
      </span>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <span className="mt-1 block text-xl font-semibold tabular-nums">
          {valor.toLocaleString("pt-BR")}
        </span>
      )}
      <span className="mt-0.5 block text-xs text-muted-foreground">{detalhe}</span>
    </button>
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

  const abas: { valor: StatusFila | null; rotulo: string; total?: number }[] = [
    { valor: null, rotulo: "Todas" },
    { valor: "pendente", rotulo: "Pendentes", total: conta("pendente") },
    { valor: "erro", rotulo: "Com erro", total: conta("erro") },
    { valor: "morto", rotulo: "Mortas", total: conta("morto") },
  ];

  return (
    <>
      {semWorker && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>Nenhum processador consumindo a fila.</b> Nenhuma rotina agendada rodou até agora
            neste ambiente. As mensagens ficam acumuladas em <b>pendente</b> até que o processo de
            fila esteja no ar — por isso nada saiu por e-mail, SMS ou webhook.
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Mensagens" className="min-w-0 rounded-lg border border-border bg-card">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Inbox className="size-4" /> Mensagens
                </h2>
                <p className="text-xs text-muted-foreground">
                  O conteúdo aparece mascarado: e-mail, telefone e documento não são exibidos em
                  claro.
                </p>
              </div>
              {podeReprocessar && mortasNaLista.length > 0 && (
                <Button
                  size="sm"
                  disabled={reprocessar.isPending || marcadas.size === 0}
                  onClick={() => reprocessar.mutate()}
                >
                  <RotateCw
                    className={`mr-2 size-4 ${reprocessar.isPending ? "animate-spin" : ""}`}
                  />
                  Reprocessar{marcadas.size ? ` ${marcadas.size}` : ""}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Situação das mensagens"
                className="flex flex-wrap gap-1"
              >
                {abas.map((a) => (
                  <Button
                    key={a.rotulo}
                    size="sm"
                    variant={status === a.valor ? "default" : "outline"}
                    aria-pressed={status === a.valor}
                    onClick={() => onStatus(a.valor)}
                  >
                    {a.rotulo}
                    {a.total != null ? ` (${a.total})` : ""}
                  </Button>
                ))}
              </div>
              {faixas.length > 1 && (
                <Select
                  value={faixa ?? TODAS}
                  onValueChange={(v) => onFaixa(v === TODAS ? null : v)}
                >
                  <SelectTrigger className="w-full sm:w-48" aria-label="Faixa da fila">
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
          </div>

          {carregando ? (
            <div className="p-4">
              <Skeleton className="h-24" />
            </div>
          ) : mensagens.length === 0 ? (
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Inbox className="size-4" /> Nenhuma mensagem nesta situação.
            </p>
          ) : (
            <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
              {mensagens.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-4">
                  {podeReprocessar && m.status === "morto" && (
                    <Checkbox
                      className="mt-0.5"
                      checked={marcadas.has(m.id)}
                      onCheckedChange={() => alternar(m.id)}
                      aria-label={`Marcar a mensagem ${m.tipo} para reprocessar`}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="min-w-0 break-all font-mono text-xs">{m.tipo}</span>
                      <BadgeStatus status={m.status} />
                      {m.tentativas > 0 && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {m.tentativas}/{m.max_tentativas} tentativa(s)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.conta ?? "sem conta"} · {m.faixa} · criada {relativo(m.criado_em)}
                      {m.proximo_em && m.status !== "concluido"
                        ? new Date(m.proximo_em) <= new Date()
                          ? " · pronta para processar"
                          : ` · próxima tentativa ${relativo(m.proximo_em)}`
                        : ""}
                    </p>
                    {m.erro && (
                      <p className="break-words rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                        {m.erro}
                      </p>
                    )}
                    <details>
                      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <Code className="size-3.5" aria-hidden /> ver conteúdo
                      </summary>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px]">
                        {JSON.stringify(m.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label="Fila por faixa"
          className="min-w-0 rounded-lg border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">Fila por faixa</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Mensagens que ainda não foram concluídas. Toque numa faixa para filtrar.
          </p>
          {carregando ? (
            <Skeleton className="h-24" />
          ) : porFaixa.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Fila vazia: nada pendente, em processamento, com erro ou morto.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {porFaixa.map((x) => (
                  <li key={x.faixa}>
                    <button
                      type="button"
                      onClick={() => onFaixa(faixa === x.faixa ? null : x.faixa)}
                      aria-pressed={faixa === x.faixa}
                      title={`${x.p} pendente(s), ${x.r} em processamento, ${x.e} com erro, ${x.m} morta(s)`}
                      className={`grid w-full grid-cols-[6.5rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 ${faixa === x.faixa ? "bg-muted" : ""}`}
                    >
                      <span className="truncate font-mono">{x.faixa}</span>
                      <span
                        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
                        style={{ width: `${Math.max(8, (x.total / maior) * 100)}%` }}
                      >
                        <i className="bg-primary" style={{ width: `${(x.p / x.total) * 100}%` }} />
                        <i className="bg-sky-400" style={{ width: `${(x.r / x.total) * 100}%` }} />
                        <i
                          className="bg-amber-400"
                          style={{ width: `${(x.e / x.total) * 100}%` }}
                        />
                        <i
                          className="bg-destructive"
                          style={{ width: `${(x.m / x.total) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">
                        <b>{x.total}</b>
                        {x.antiga && (
                          <span className="block text-[10px] text-muted-foreground">
                            {relativo(x.antiga)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <Legenda cor="bg-primary" texto="pendente" />
                <Legenda cor="bg-sky-400" texto="processando" />
                <Legenda cor="bg-amber-400" texto="com erro" />
                <Legenda cor="bg-destructive" texto="morta" />
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`size-2.5 rounded-full ${cor}`} /> {texto}
    </span>
  );
}

function BadgeStatus({ status }: { status: string }) {
  const rotulo = STATUS_ROTULO[status] ?? status;
  if (status === "morto") return <Badge variant="destructive">{rotulo}</Badge>;
  if (status === "erro")
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900">
        {rotulo}
      </Badge>
    );
  if (status === "concluido")
    return (
      <Badge variant="outline" className="text-emerald-700">
        {rotulo}
      </Badge>
    );
  return <Badge variant="secondary">{rotulo}</Badge>;
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
    <section aria-label="Provedores externos" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Cable className="size-4" /> Provedores externos — 7 dias
        </h2>
        <p className="text-xs text-muted-foreground">
          Chamadas a Serasa, Boa Vista, integração bancária, APIFull, Asaas e portais.
        </p>
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : provedores.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nenhum provedor externo respondeu nos últimos 7 dias — as chaves ainda não foram
          configuradas ou nada foi chamado.
        </p>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {provedores.map((p) => {
            const info = PROVEDOR[p.provedor] ?? { nome: p.provedor, desc: "Provedor externo" };
            const erros = Number(p.erros);
            return (
              <li
                key={p.provedor}
                className={`min-w-0 space-y-2 rounded-lg border p-3 ${erros ? "border-destructive/40" : "border-border"}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{info.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{info.desc}</p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dd className="font-semibold tabular-nums">
                      {Number(p.chamadas).toLocaleString("pt-BR")}
                    </dd>
                    <dt className="text-[11px] text-muted-foreground">chamadas</dt>
                  </div>
                  <div>
                    <dd className={`font-semibold tabular-nums ${erros ? "text-destructive" : ""}`}>
                      {erros.toLocaleString("pt-BR")}
                    </dd>
                    <dt className="text-[11px] text-muted-foreground">erros</dt>
                  </div>
                  <div>
                    <dd className="font-semibold tabular-nums">{tempo(p.latencia_ms)}</dd>
                    <dt className="text-[11px] text-muted-foreground">média</dt>
                  </div>
                </dl>
                {erros > 0 ? (
                  <Badge variant="destructive">
                    {erros} erro(s){p.ultima ? ` · última ${relativo(p.ultima)}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-700">
                    sem erro{p.ultima ? ` · última ${relativo(p.ultima)}` : ""}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function tomHttp(s: number | null, erro: string | null): "ok" | "erro" | "neutro" {
  if (erro || (s != null && s >= 400)) return "erro";
  if (s != null) return "ok";
  return "neutro";
}

/** Abre em "só erro" de propósito: quem chega aqui geralmente chegou porque algo falhou. */
function Log({ linhas, carregando }: { linhas: LinhaLog[]; carregando: boolean }) {
  const [soErro, setSoErro] = useState(true);
  const comErro = linhas.filter((l) => l.erro || (l.status_http ?? 0) >= 400);
  const lista = soErro ? comErro : linhas;
  return (
    <section aria-label="Chamadas recentes" className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4" /> Chamadas aos provedores
          </h2>
          <p className="text-xs text-muted-foreground">Últimas 24 horas.</p>
        </div>
        <div role="group" aria-label="Filtro das chamadas" className="flex gap-1">
          <Button
            size="sm"
            variant={soErro ? "default" : "outline"}
            aria-pressed={soErro}
            onClick={() => setSoErro(true)}
          >
            Só erro{comErro.length ? ` (${comErro.length})` : ""}
          </Button>
          <Button
            size="sm"
            variant={!soErro ? "default" : "outline"}
            aria-pressed={!soErro}
            onClick={() => setSoErro(false)}
          >
            Tudo ({linhas.length})
          </Button>
        </div>
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : lista.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          {soErro
            ? "Nenhum provedor devolveu erro nas últimas 24 horas. Em “Tudo” estão as chamadas que deram certo."
            : "Nenhum provedor foi chamado nas últimas 24 horas. Sem chave configurada, nada sai daqui."}
        </p>
      ) : (
        <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
          {lista.map((l) => {
            const tom = tomHttp(l.status_http, l.erro);
            return (
              <li key={l.id} className="flex items-start gap-3 px-4 py-2.5">
                <Badge
                  variant={tom === "erro" ? "destructive" : "outline"}
                  className={`shrink-0 tabular-nums ${tom === "ok" ? "text-emerald-700" : ""}`}
                >
                  {l.status_http ?? (l.erro ? "falhou" : "—")}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-medium">{l.provedor}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {l.metodo ?? ""} {l.endpoint ?? ""}
                    </span>
                  </span>
                  {l.erro && (
                    <span className="block break-words text-xs text-destructive">{l.erro}</span>
                  )}
                </span>
                <span className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {l.duracao_ms != null ? `${l.duracao_ms} ms` : "—"}
                  <span className="block">{relativo(l.criado_em)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────────────────── Rotinas ───────────────────────── */

function Rotinas({ jobs, carregando }: { jobs: JobPlataforma[]; carregando: boolean }) {
  const podeEditar = usePermissao("saas.integracoes", "edit");
  return (
    <section aria-label="Rotinas agendadas" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" /> Rotinas agendadas ({jobs.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Rotinas que rodam sozinhas: partições, retenção, lembretes, reajustes, cobranças, saúde
          das contas.
        </p>
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Nenhuma rotina agendada neste ambiente.</p>
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((j) => (
            <LinhaRotina key={j.nome} j={j} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </section>
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
    <li className="flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="min-w-0 break-all font-mono text-xs">{j.nome}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {j.cron}
          </span>
          {!j.ativo && <Badge variant="secondary">Desligada</Badge>}
          {j.ultimo_status &&
            (erro ? (
              <Badge variant="destructive">Erro</Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-700">
                {j.ultimo_status === "sucesso" ? "OK" : j.ultimo_status}
              </Badge>
            ))}
        </p>
        {j.descricao && <p className="text-xs text-muted-foreground">{j.descricao}</p>}
        <p className="text-xs text-muted-foreground">
          {j.ultimo_inicio ? `última execução ${relativo(j.ultimo_inicio)}` : "nunca executada"}
          {j.proxima_execucao ? ` · próxima ${relativo(j.proxima_execucao)}` : ""}
        </p>
        {j.ultimo_erro && (
          <p className="break-words rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
            {j.ultimo_erro}
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
  // A integração bancária aparece no log como "homefin"; os birôs, como "biro-credito".
  const chamadasDe = (p: string) =>
    provedores.find(
      (x) =>
        x.provedor === p ||
        (x.provedor === "biro-credito" && (p === "serasa" || p === "spc" || p === "boavista")),
    );
  return (
    <section aria-label="Integrações de crédito" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <p className="flex min-w-0 flex-1 items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            A integração bancária, que leva as propostas aos bancos, e os birôs de consulta.
            Ambiente: <b>{ambiente === "producao" ? "Produção" : "Homologação"}</b>. As chaves ficam
            cifradas no banco e são cadastradas em “Chaves dos provedores”.
          </span>
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/plataforma/provedores">
            <KeySquare className="mr-2 size-4" /> Gerenciar chaves
          </Link>
        </Button>
      </div>

      {carregando ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {PROVEDORES_DO_CREDITO.map((p) => {
            const cat = CATALOGO[p as ProvedorConhecido];
            const c = credenciais.find((x) => x.provedor === p) ?? null;
            const ch = chamadasDe(p);
            const dicas = c ? dicasEmTexto(c.dicas) : [];
            return (
              <li key={p} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{cat?.rotulo ?? p}</p>
                    <p className="text-xs text-muted-foreground">{cat?.descricao}</p>
                  </div>
                  {!c ? (
                    <Badge variant="secondary">Não configurada</Badge>
                  ) : c.ativo ? (
                    <Badge variant="outline" className="text-emerald-700">
                      <CheckCircle2 className="mr-1 size-3" /> Ligada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                      Desligada
                    </Badge>
                  )}
                </div>
                {c && (
                  <dl className="space-y-1 text-xs">
                    {dicas.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">Chaves</dt>
                        <dd className="min-w-0 break-all font-mono">{dicas.join(" · ")}</dd>
                      </div>
                    )}
                    {c.base_url && (
                      <div className="flex flex-wrap gap-x-3">
                        <dt className="text-muted-foreground">Endereço</dt>
                        <dd className="min-w-0 break-all">{c.base_url}</dd>
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
    </section>
  );
}
