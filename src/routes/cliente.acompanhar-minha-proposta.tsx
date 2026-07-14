import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  FileText,
  Building2,
  Home,
  DollarSign,
  Clock,
  User,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Calendar,
  Upload,
  Eye,
  Headphones,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Tooltip as RTooltip,
} from "recharts";
import { clienteObterAcompanhamento } from "@/lib/portal/cliente.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/acompanhar-minha-proposta")({
  head: () => ({ meta: [{ title: "Acompanhar minha proposta — Meu Financiamento" }] }),
  component: Acompanhar,
});

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtData(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", opts ?? { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const isHoje = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isHoje) return `Hoje, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}

function diasNaEtapa(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function Acompanhar() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "acompanhamento"],
    queryFn: () => clienteObterAcompanhamento(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 15000),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { processo, etapas, resumo, historico, evolucao, documentos_pendentes, prazo_proxima_etapa } = data;
  const total = processo.total || etapas.length || 1;
  const progresso = total > 0 ? Math.round((processo.ordem_atual / total) * 100) : 0;
  const dias = diasNaEtapa(processo.ultima_atualizacao);
  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  const emAndamento = etapas.filter((e) => e.status === "atual").length;
  const restantes = etapas.filter((e) => e.status !== "concluida").length;
  const pendentes = Math.max(0, restantes - emAndamento);

  const heroData = [{ name: "p", value: progresso, fill: "#ffffff" }];
  const panoramaData = [
    { name: "Concluído", value: concluidas, cor: "var(--primary)" },
    { name: "Em andamento", value: emAndamento, cor: "color-mix(in oklab, var(--primary) 55%, white)" },
    { name: "Pendente", value: pendentes, cor: "color-mix(in oklab, var(--primary) 15%, white)" },
  ].filter((d) => d.value > 0);
  const distribuicao = [
    { name: "Concluídas", value: concluidas, fill: "var(--primary)" },
    { name: "Em andamento", value: emAndamento, fill: "color-mix(in oklab, var(--primary) 55%, white)" },
    { name: "Pendentes", value: pendentes, fill: "color-mix(in oklab, var(--primary) 20%, white)" },
  ];
  const evolucaoData = evolucao.map((e) => ({
    dia: new Date(e.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    percentual: e.percentual,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {/* HERO */}
        <div
          className="relative overflow-hidden rounded-2xl text-primary-foreground shadow-lg"
          style={{ background: "linear-gradient(120deg, #000a6b 0%, #000f9f 45%, #1a2ec4 100%)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-20 md:block"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 55%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.12) 56%, transparent 56%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.18), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px)",
            }}
          />
          <div className="relative space-y-4 p-4 sm:p-5 md:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight tracking-tight sm:text-2xl md:text-3xl">
                  Acompanhar minha proposta
                </h1>
                <p className="mt-0.5 text-[11px] opacity-85 sm:text-sm">
                  Acompanhe cada etapa em tempo real.
                </p>
              </div>
              <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="72%" outerRadius="100%" data={heroData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: "rgba(255,255,255,0.18)" }} dataKey="value" cornerRadius={20} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold sm:text-sm">{progresso}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm ring-1 ring-white/15">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 sm:h-12 sm:w-12">
                <Send className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80 sm:text-[10px]">Etapa atual</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {dias === 0 ? "Hoje" : dias != null ? `Há ${dias}d` : "Aguardando"}
                  </span>
                  <span className="ml-auto text-[10px] opacity-80">
                    Etapa {processo.ordem_atual}/{total}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold leading-snug sm:text-base">
                  {processo.etapa_atual ?? "Processo em andamento"}
                </p>
                {processo.descricao && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] opacity-85 sm:text-xs">{processo.descricao}</p>
                )}
              </div>
            </div>

            {/* Stepper */}
            <div className="-mx-1 overflow-x-auto pb-1">
              <ol className="flex min-w-max items-start gap-1 px-1">
                {etapas.map((etapa, i) => {
                  const done = etapa.status === "concluida";
                  const curr = etapa.status === "atual";
                  const last = i === etapas.length - 1;
                  return (
                    <li key={etapa.ordem} className="flex items-start">
                      <div className="flex w-16 flex-col items-center text-center sm:w-20">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 transition sm:h-8 sm:w-8 sm:text-xs",
                            done && "bg-white text-primary ring-white",
                            curr && "bg-white text-primary ring-white shadow-lg shadow-black/20 animate-pulse",
                            !done && !curr && "bg-white/10 text-white/70 ring-white/30",
                          )}
                        >
                          {done ? <Check className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={3} /> : etapa.ordem}
                        </span>
                        <span className={cn("mt-1 line-clamp-2 text-[9px] leading-tight sm:text-[10px]", curr ? "font-semibold" : "opacity-80")}>
                          {etapa.nome}
                        </span>
                      </div>
                      {!last && (
                        <span
                          className={cn("mt-3.5 h-0.5 w-3 shrink-0 sm:mt-4 sm:w-4", done ? "bg-white" : "bg-white/25")}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>

        {/* CHARTS ROW */}
        <div className="grid gap-4 md:grid-cols-3">
          <ChartCard titulo="Progresso da jornada">
            <div className="relative flex items-center justify-center">
              <div className="relative h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={panoramaData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={panoramaData.length > 1 ? 2 : 0} stroke="none">
                      {panoramaData.map((d) => <Cell key={d.name} fill={d.cor} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{progresso}%</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Concluído</span>
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {[
                { k: "Concluído", v: concluidas, cor: "var(--primary)" },
                { k: "Em andamento", v: emAndamento, cor: "color-mix(in oklab, var(--primary) 55%, white)" },
                { k: "Pendente", v: pendentes, cor: "color-mix(in oklab, var(--primary) 20%, white)" },
              ].map((r) => (
                <li key={r.k} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: r.cor }} />
                  <span className="flex-1 text-foreground">{r.k} ({r.v})</span>
                  <span className="font-medium text-muted-foreground">{Math.round((r.v / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard titulo="Próximos passos">
            <ol className="space-y-2.5">
              {(() => {
                const proximas = etapas.filter((e) => e.status !== "concluida").slice(0, 4);
                if (proximas.length === 0) {
                  return (
                    <li className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-sm text-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Processo concluído. Parabéns!
                    </li>
                  );
                }
                return proximas.map((e, i) => {
                  const atual = e.status === "atual";
                  return (
                    <li key={e.ordem} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-2 transition",
                          atual
                            ? "bg-primary text-primary-foreground ring-primary/30 animate-pulse"
                            : "bg-primary/10 text-primary ring-primary/15",
                        )}
                      >
                        {e.ordem}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm leading-tight",
                            atual ? "font-semibold text-foreground" : "text-foreground/80",
                          )}
                        >
                          {e.nome}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {atual ? "Em andamento agora" : i === 0 ? "Próxima etapa" : `Em ${i + 1}º na fila`}
                        </p>
                      </div>
                    </li>
                  );
                });
              })()}
            </ol>
          </ChartCard>

          <ChartCard titulo="Evolução dos últimos dias">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <RTooltip formatter={(v: any) => [`${v}%`, "Progresso"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="percentual" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* STAT CARDS BOTTOM */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MiniStat icon={ClipboardCheck} valor={String(concluidas)} label="Etapas concluídas" hint={`${Math.round((concluidas / total) * 100)}% do processo`} />
          <MiniStat icon={ListChecks} valor={String(restantes)} label="Etapas restantes" hint={`${Math.round((restantes / total) * 100)}% do processo`} />
          <MiniStat icon={FileText} valor={String(documentos_pendentes)} label="Documentos pendentes" linkLabel={documentos_pendentes ? "Ver documentos" : "Tudo em dia"} to="/cliente/chat" />
          <MiniStat icon={Calendar} valor={`Até ${fmtData(prazo_proxima_etapa, { day: "2-digit", month: "2-digit", year: "numeric" })}`} label="Prazo estimado" hint="Para próxima etapa" small />
          <MiniStat icon={Clock} valor={fmtDataHora(processo.ultima_atualizacao)} label="Última atualização" hint={processo.etapa_atual ?? undefined} small />
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="space-y-4">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Resumo do status</p>
            <dl className="space-y-2.5 text-sm">
              <ResumoLinha icon={FileText} label="Nº da proposta" value={resumo?.numero_proposta ?? "—"} />
              <ResumoLinha icon={Building2} label="Banco em análise" value={resumo?.banco ?? "—"} />
              <ResumoLinha icon={Home} label="Valor do imóvel" value={fmtBRL(resumo?.valor_imovel)} />
              <ResumoLinha icon={DollarSign} label="Valor solicitado" value={fmtBRL(resumo?.valor_solicitado)} />
              <ResumoLinha icon={Clock} label="Prazo do financiamento" value={resumo?.prazo ? `${resumo.prazo} meses` : "—"} />
              <ResumoLinha
                icon={User}
                label="Responsável"
                value={resumo?.responsavel_nome ?? "—"}
                sub={resumo?.responsavel_nome ? "Especialista de crédito" : undefined}
              />
            </dl>
          </CardContent>
        </Card>


        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-2 p-5">
            <p className="mb-2 text-sm font-semibold text-foreground">Próximas ações</p>
            <Button asChild className="w-full justify-start" size="sm">
              <Link to="/cliente/chat"><Upload className="mr-1.5 h-4 w-4" />Enviar documentos</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to="/cliente/chat"><Headphones className="mr-1.5 h-4 w-4" />Falar com especialista</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to="/cliente/visao-geral"><Eye className="mr-1.5 h-4 w-4" />Ver visão geral</Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <p className="mb-2 text-xs font-semibold text-foreground sm:text-sm">{titulo}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  valor,
  label,
  hint,
  linkLabel,
  to,
  small,
}: {
  icon: typeof FileText;
  valor: string;
  label: string;
  hint?: string;
  linkLabel?: string;
  to?: string;
  small?: boolean;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={cn("truncate font-bold text-foreground", small ? "text-sm" : "text-2xl leading-tight")}>
            {valor}
          </p>
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{hint}</p>}
          {linkLabel && to && (
            <Link to={to} className="mt-0.5 inline-block truncate text-[11px] font-medium text-primary hover:underline">
              {linkLabel}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResumoLinha({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
