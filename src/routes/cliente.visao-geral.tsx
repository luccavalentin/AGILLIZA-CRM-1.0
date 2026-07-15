import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  MessageSquare,
  Clock,
  CheckCircle2,
  ListChecks,
  FileSignature,
  Target,
  Headphones,
  ChevronRight,
  Check,
  ClipboardCheck,
  FolderOpen,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { clienteObterVisaoGeral } from "@/lib/portal/cliente.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/visao-geral")({
  head: () => ({ meta: [{ title: "Início — Meu Financiamento" }] }),
  component: VisaoGeral,
});

function diasNaEtapa(iso: string | null) {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return dias;
}

function formatarData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  day: "2-digit", month: "short" });
}

function StatCard({
  icon: Icon,
  label,
  valor,
  hint,
  hintTone = "muted",
  to,
}: {
  icon: typeof FileText;
  label: string;
  valor: string;
  hint?: string;
  hintTone?: "muted" | "primary" | "success";
  to?: string;
}) {
  const inner = (
    <CardContent className="flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold leading-tight text-foreground">{valor}</p>
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {hint && (
          <p
            className={cn(
              "truncate text-[11px] font-medium",
              hintTone === "primary" && "text-primary",
              hintTone === "success" && "text-success",
              hintTone === "muted" && "text-muted-foreground/80",
            )}
          >
            {hint}
          </p>
        )}
      </div>
      {to && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </CardContent>
  );
  const cardCls =
    "group border-border/70 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
  if (to) {
    return (
      <Link to={to as any} className="block rounded-xl">
        <Card className={cn(cardCls, "cursor-pointer active:scale-[0.99]")}>{inner}</Card>
      </Link>
    );
  }
  return <Card className={cardCls}>{inner}</Card>;
}

function VisaoGeral() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "visao-geral"],
    queryFn: () => clienteObterVisaoGeral(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 15000),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const { processo, etapas, propostas, documentos_pendentes } = data;
  const dias = diasNaEtapa(processo.ultima_atualizacao);
  const progresso =
    processo.total > 0 ? Math.round((processo.ordem_atual / processo.total) * 100) : 0;

  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  const emAndamento = etapas.filter((e) => e.status === "atual").length;
  const restantes = etapas.filter((e) => e.status !== "concluida").length;
  const pendentes = Math.max(0, restantes - emAndamento);
  const total = processo.total || etapas.length || 1;

  const heroData = [{ name: "p", value: progresso, fill: "#ffffff" }];
  const panoramaData = [
    { name: "Concluídas", value: concluidas, cor: "var(--primary)" },
    { name: "Em andamento", value: emAndamento, cor: "color-mix(in oklab, var(--primary) 55%, white)" },
    { name: "Pendentes", value: pendentes, cor: "color-mix(in oklab, var(--primary) 15%, white)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-2xl text-primary-foreground shadow-xl"
        style={{
          background:
            "linear-gradient(120deg, #000a6b 0%, #000f9f 45%, #1a2ec4 100%)",
        }}
      >
        {/* padrão sutil de arquitetura */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-25 md:block"
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 55%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.12) 56%, transparent 56%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.18), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 44px)",
          }}
        />
        <div className="relative grid gap-4 p-4 sm:gap-6 sm:p-8 md:grid-cols-[220px_1fr] md:items-center">
          {/* Cabeçalho compacto no mobile: radial ao lado do título */}
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 md:block">
            {/* Progress radial */}
            <div className="relative h-28 w-28 md:mx-0 md:h-44 md:w-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="78%"
                  outerRadius="100%"
                  data={heroData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    background={{ fill: "rgba(255,255,255,0.18)" }}
                    dataKey="value"
                    cornerRadius={20}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight sm:text-4xl">{progresso}%</span>
                <span className="text-[10px] font-medium opacity-80 sm:text-xs">concluído</span>
              </div>
            </div>
            {/* Título ao lado no mobile */}
            <div className="min-w-0 md:hidden">
              <h1 className="truncate text-xl font-bold leading-tight tracking-tight">
                Meu <span className="font-light">financiamento</span>
              </h1>
              <p className="mt-1 text-[11px] leading-snug opacity-85">
                Evolução do seu processo em tempo real
              </p>
            </div>
          </div>

          {/* Texto */}
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden md:block">
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Meu <span className="font-light">financiamento</span>
              </h1>
              <p className="mt-1 text-sm opacity-85">
                Acompanhe a evolução do seu processo em tempo real
              </p>
            </div>
            <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm sm:px-3 sm:py-1 sm:text-[11px]">
              Etapa atual
            </span>
            <div>
              <p className="text-lg font-semibold leading-snug sm:text-2xl">
                {processo.etapa_atual ?? "Processo em andamento"}
              </p>
              {processo.descricao && (
                <p className="mt-1 max-w-xl text-xs opacity-85 sm:text-sm">{processo.descricao}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs sm:gap-x-5 sm:gap-y-2 sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/90" />
                Etapa {processo.ordem_atual} de {processo.total || etapas.length}
              </span>
              <span className="h-4 w-px bg-white/25" />
              <span className="inline-flex items-center gap-1.5 opacity-90">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {dias == null
                  ? "Aguardando atualização"
                  : dias === 0
                    ? "Atualizado hoje"
                    : `Há ${dias} dia${dias > 1 ? "s" : ""} nesta etapa`}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={ClipboardCheck}
          label="Etapas concluídas"
          valor={`${concluidas}/${total}`}
          hint={`${Math.round((concluidas / total) * 100)}% do processo`}
          to="/cliente/acompanhar-minha-proposta"
        />
        <StatCard
          icon={ListChecks}
          label="Etapas restantes"
          valor={String(restantes)}
          hint="Até a conclusão"
          to="/cliente/acompanhar-minha-proposta"
        />
        <StatCard
          icon={FileText}
          label="Documentos pendentes"
          valor={String(documentos_pendentes.length)}
          hint={documentos_pendentes.length === 0 ? "Tudo em dia!" : "Enviar pelo chat"}
          hintTone={documentos_pendentes.length === 0 ? "success" : "primary"}
          to="/cliente/chat"
        />
        <StatCard
          icon={FileSignature}
          label="Propostas ativas"
          valor={String(propostas.length)}
          hint="Acompanhe sua proposta"
          to="/cliente/acompanhar-minha-proposta"
        />
      </div>

      {/* PANORAMA + TIMELINE */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Panorama do processo */}
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Panorama do processo</p>
                  <p className="text-xs text-muted-foreground">Visão geral da sua jornada</p>
                </div>
              </div>

              <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
                <div className="relative mx-auto h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={panoramaData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={78}
                        paddingAngle={panoramaData.length > 1 ? 2 : 0}
                        stroke="none"
                      >
                        {panoramaData.map((d) => (
                          <Cell key={d.name} fill={d.cor} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{progresso}%</span>
                    <span className="text-[11px] text-muted-foreground">concluído</span>
                  </div>
                </div>

                <ul className="space-y-2 text-sm">
                  {[
                    {
                      k: "Concluídas",
                      v: concluidas,
                      cor: "var(--primary)",
                    },
                    {
                      k: "Em andamento",
                      v: emAndamento,
                      cor: "color-mix(in oklab, var(--primary) 55%, white)",
                    },
                    {
                      k: "Pendentes",
                      v: pendentes,
                      cor: "color-mix(in oklab, var(--primary) 20%, white)",
                    },
                  ].map((r) => (
                    <li key={r.k} className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: r.cor }}
                      />
                      <span className="flex-1 text-foreground">{r.k}</span>
                      <span className="text-muted-foreground">
                        {r.v} {r.v === 1 ? "etapa" : "etapas"}
                      </span>
                      <span className="w-10 text-right font-medium text-foreground">
                        {Math.round((r.v / total) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Próximas ações */}
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Próximas ações</p>
                  <p className="text-xs text-muted-foreground">O que você pode fazer agora</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <AcaoChip
                  to="/cliente/chat"
                  icon={MessageSquare}
                  label="Enviar documentos pelo chat"
                />
                <AcaoChip to="/cliente/chat" icon={Headphones} label="Falar com especialista" />
                <AcaoChip
                  to="/cliente/acompanhar-minha-proposta"
                  icon={FolderOpen}
                  label="Ver detalhes da proposta"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline passo a passo */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Seu processo passo a passo</p>
                <p className="text-xs text-muted-foreground">
                  Acompanhe cada etapa da sua jornada
                </p>
              </div>
            </div>

            <ol className="relative space-y-3">
              {etapas.map((etapa, i) => {
                const ultimo = i === etapas.length - 1;
                const dataLabel =
                  etapa.status === "concluida" && etapa.concluida_em
                    ? `Concluída em ${formatarData(etapa.concluida_em)}`
                    : etapa.status === "atual"
                      ? dias === 0
                        ? "Atualizado hoje"
                        : dias != null
                          ? `Há ${dias} dia${dias > 1 ? "s" : ""}`
                          : null
                      : null;
                return (
                  <li key={etapa.ordem} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4",
                          etapa.status === "concluida" &&
                            "bg-primary text-primary-foreground ring-primary/10",
                          etapa.status === "atual" &&
                            "bg-primary text-primary-foreground ring-primary/20 animate-pulse",
                          etapa.status === "proxima" &&
                            "bg-muted text-muted-foreground ring-transparent",
                        )}
                      >
                        {etapa.status === "concluida" ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          etapa.ordem
                        )}
                      </span>
                      {!ultimo && (
                        <span
                          className={cn(
                            "mt-1 w-0.5 flex-1 min-h-6",
                            etapa.status === "concluida" ? "bg-primary/40" : "bg-border",
                          )}
                        />
                      )}
                    </div>
                    <div
                      className={cn(
                        "flex-1 pb-3",
                        etapa.status === "atual" &&
                          "-mx-2 rounded-lg bg-primary/5 px-2 py-1.5",
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p
                          className={cn(
                            "font-semibold leading-tight",
                            etapa.status === "atual" && "text-primary",
                            etapa.status === "proxima" && "text-muted-foreground",
                            etapa.status === "concluida" && "text-foreground",
                          )}
                        >
                          {etapa.nome}
                        </p>
                        {dataLabel && (
                          <span className="text-xs text-muted-foreground">{dataLabel}</span>
                        )}
                      </div>
                      {etapa.status !== "proxima" && etapa.descricao_cliente && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {etapa.descricao_cliente}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AcaoChip({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 leading-tight">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
