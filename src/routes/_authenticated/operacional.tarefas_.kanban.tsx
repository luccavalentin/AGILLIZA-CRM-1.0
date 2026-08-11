import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  KanbanSquare,
  List,
  Loader2,
  Search,
  User2,
  XCircle,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarTarefas,
  moverStatusTarefa,
  transicaoTarefaPermitida,
  type TarefaStatus,
} from "@/lib/operacional/tarefas.functions";
import { statusTarefa } from "@/components/operacional/status";
import { PriorityChip, OpAvatar, OpHero } from "@/components/operacional/ui";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/tarefas_/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban de Tarefas — Agilliza" },
      {
        name: "description",
        content:
          "Fluxo visual das tarefas operacionais por etapa, com arrastar e soltar, filtros e prazos.",
      },
      { property: "og:title", content: "Kanban de Tarefas — Agilliza" },
      {
        property: "og:description",
        content: "Acompanhe o fluxo das tarefas da operação por etapa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

const COLUNAS: Array<{
  id: TarefaStatus;
  accent: string;
  icon: typeof Clock;
  vazio: string;
}> = [
  {
    id: "aberta",
    accent: "var(--primary)",
    icon: List,
    vazio: "Crie uma tarefa para iniciar o fluxo.",
  },
  {
    id: "em_andamento",
    accent: "var(--warning)",
    icon: Loader2,
    vazio: "Arraste uma tarefa para esta etapa para iniciar o andamento.",
  },
  {
    id: "concluida",
    accent: "var(--success)",
    icon: CheckCircle2,
    vazio: "As tarefas concluídas aparecerão aqui após finalização.",
  },
  {
    id: "cancelada",
    accent: "var(--muted-foreground)",
    icon: XCircle,
    vazio: "As tarefas canceladas aparecerão aqui para referência.",
  },
];

function fmtPrazo(iso: string | null): string {
  if (!iso) return "Sem prazo";
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vencida(prazo: string | null, status: string): boolean {
  if (!prazo || status === "concluida" || status === "cancelada") return false;
  return new Date(prazo).getTime() < Date.now();
}

function Pagina() {
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusTarefa);
  const [arrastando, setArrastando] = useState<{ id: string; status: TarefaStatus } | null>(null);
  const [sobre, setSobre] = useState<TarefaStatus | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [prioridade, setPrioridade] = useState<string>("todas");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [ordem, setOrdem] = useState<"recentes" | "prazo" | "prioridade">("recentes");
  const [escopo, setEscopo] = useState<"todas" | "minhas">(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem("tarefas:escopo") as "todas" | "minhas")) ||
      "todas",
  );

  const { data, refetch } = useQuery({
    queryKey: ["tarefas", "kanban", escopo],
    queryFn: () => listarTarefas({ data: { escopo } }),
  });

  const itens = useMemo(() => data ?? [], [data]);

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    for (const t of itens) if (t.nome_responsavel) set.add(t.nome_responsavel);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itens]);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    const peso: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
    const lista = itens.filter((t) => {
      if (prioridade !== "todas" && t.prioridade !== prioridade) return false;
      if (responsavel !== "todos" && t.nome_responsavel !== responsavel) return false;
      if (!termo) return true;
      return `${t.titulo} ${t.numero ?? ""} ${t.nome_responsavel ?? ""} ${t.nome_cliente ?? ""}`
        .toLowerCase()
        .includes(termo);
    });
    return [...lista].sort((a, b) => {
      if (ordem === "prioridade") return (peso[a.prioridade] ?? 9) - (peso[b.prioridade] ?? 9);
      if (ordem === "prazo") {
        const va = a.prazo ? new Date(a.prazo).getTime() : Infinity;
        const vb = b.prazo ? new Date(b.prazo).getTime() : Infinity;
        return va - vb;
      }
      return 0;
    });
  }, [itens, q, prioridade, responsavel, ordem]);

  async function soltar(coluna: TarefaStatus) {
    setSobre(null);
    if (!arrastando) return;
    const { id, status } = arrastando;
    setArrastando(null);
    if (status === coluna) return;
    if (!transicaoTarefaPermitida(status, coluna)) {
      toast.error(
        `Transição inválida: ${statusTarefa(status).label} → ${statusTarefa(coluna).label}.`,
      );
      return;
    }
    try {
      await moverFn({ data: { id, status: coluna } });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success(`Tarefa movida para ${statusTarefa(coluna).label}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <OpHero
        icon={<KanbanSquare className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Kanban de Tarefas"
        descricao="Acompanhe o fluxo das atividades da operação com visão por etapa."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas">
                <List className="mr-1.5 h-4 w-4" /> Lista
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas/calendario">
                <CalendarDays className="mr-1.5 h-4 w-4" /> Calendário
              </Link>
            </Button>
            <NovaTarefaDialog onCriada={refetch} />
          </>
        }
      />

      {/* Barra de controle */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs
          value={escopo}
          onValueChange={(v) => {
            const val = v as "todas" | "minhas";
            setEscopo(val);
            if (typeof window !== "undefined") localStorage.setItem("tarefas:escopo", val);
          }}
        >
          <TabsList className="h-10 rounded-xl">
            <TabsTrigger value="minhas" className="rounded-lg">
              Minhas
            </TabsTrigger>
            <TabsTrigger value="todas" className="rounded-lg">
              Gerais
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, código ou responsável…"
            className="h-10 rounded-xl pl-9"
          />
        </div>

        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="h-10 w-[172px] rounded-xl">
            <Flag className="mr-1 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Prioridade: Todas</SelectItem>
            <SelectItem value="p1">P1 · Urgente</SelectItem>
            <SelectItem value="p2">P2 · Alta</SelectItem>
            <SelectItem value="p3">P3 · Normal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="h-10 w-[196px] rounded-xl">
            <User2 className="mr-1 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Responsável: Todos</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
          <SelectTrigger className="h-10 w-[168px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="prazo">Prazo mais próximo</SelectItem>
            <SelectItem value="prioridade">Maior prioridade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Colunas */}
      <div className="brand-scroll flex gap-4 overflow-x-auto pb-3">
        {COLUNAS.map((col) => {
          const cfg = statusTarefa(col.id);
          const doStatus = filtrados.filter((t) => t.status === col.id);
          const alvo = arrastando && transicaoTarefaPermitida(arrastando.status, col.id);
          const Icone = col.icon;
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (alvo) setSobre(col.id);
              }}
              onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
              onDrop={() => soltar(col.id)}
              style={{ ["--op-accent" as string]: col.accent }}
              className={cn(
                "flex w-[292px] shrink-0 flex-col rounded-2xl border border-border/70 bg-[color-mix(in_oklab,var(--op-accent)_4%,var(--card))] shadow-card transition-all",
                alvo && "border-dashed border-[color:var(--op-accent)]",
                sobre === col.id &&
                  "ring-2 ring-[color:color-mix(in_oklab,var(--op-accent)_45%,transparent)]",
              )}
            >
              <header className="flex items-center gap-2 border-b border-border/60 px-3.5 py-3">
                <span
                  className="size-2 rounded-full"
                  style={{ background: "var(--op-accent)" }}
                  aria-hidden
                />
                <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
                  {cfg.label}
                </h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {doStatus.length}
                </span>
              </header>

              <div className="flex-1 space-y-2.5 p-2.5">
                {doStatus.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                    <span
                      className="grid size-10 place-items-center rounded-full text-[color:var(--op-accent)]"
                      style={{
                        background: "color-mix(in oklab, var(--op-accent) 12%, transparent)",
                      }}
                    >
                      <Icone className="size-5" />
                    </span>
                    <p className="text-[12.5px] font-medium text-foreground">Sem tarefas</p>
                    <p className="max-w-[190px] text-[11px] leading-relaxed text-muted-foreground">
                      {col.vazio}
                    </p>
                  </div>
                ) : (
                  doStatus.map((t) => {
                    const late = vencida(t.prazo, t.status);
                    const puxando = arrastando?.id === t.id;
                    return (
                      <article
                        key={t.id}
                        draggable
                        onDragStart={() => setArrastando({ id: t.id, status: t.status })}
                        onDragEnd={() => {
                          setArrastando(null);
                          setSobre(null);
                        }}
                        onClick={() => setSel(t.id)}
                        className={cn(
                          "group relative cursor-grab overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[color:color-mix(in_oklab,var(--op-accent)_45%,var(--border))] hover:shadow-[0_14px_30px_-20px_color-mix(in_oklab,var(--op-accent)_75%,transparent)] active:cursor-grabbing",
                          puxando && "opacity-60",
                        )}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[3px]"
                          style={{ background: "var(--op-accent)" }}
                        />
                        <div className="flex items-start justify-between gap-2 pl-1.5">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                            {t.titulo}
                          </p>
                          <PriorityChip prioridade={t.prioridade} />
                        </div>

                        <p className="mt-1 pl-1.5 text-[10.5px] font-medium uppercase tracking-wider tabular-nums text-muted-foreground">
                          {t.numero ?? "—"}
                        </p>

                        {t.nome_cliente ? (
                          <p className="mt-1 truncate pl-1.5 text-[11.5px] text-muted-foreground">
                            {t.nome_cliente}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 pl-1.5">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <OpAvatar nome={t.nome_responsavel} className="size-5 text-[9px]" />
                            <span className="truncate text-[11.5px] text-muted-foreground">
                              {t.nome_responsavel ?? "—"}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-muted-foreground",
                              late && "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                          >
                            <Clock className="size-3" />
                            {fmtPrazo(t.prazo)}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <footer className="border-t border-border/60 p-2">
                <NovaTarefaDialog
                  onCriada={refetch}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-full justify-center text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      + Adicionar tarefa
                    </Button>
                  }
                />
              </footer>
            </section>
          );
        })}
      </div>

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
