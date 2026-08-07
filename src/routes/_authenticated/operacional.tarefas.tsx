import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  KanbanSquare,
  CalendarDays,
  Search,
  ListChecks,
  CircleDot,
  Loader2,
  CheckCircle2,
  Clock,
  Download,
  Flag,
  ArrowDownUp,
} from "lucide-react";

import { toast } from "sonner";
import { baixarTarefasPDF } from "@/lib/operacional/pdf-lazy";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarTarefas,
  excluirTarefa,
  concluirTarefa,
  moverStatusTarefa,
} from "@/lib/operacional/tarefas.functions";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { TarefasBoard } from "@/components/operacional/tarefas-board";

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


export const Route = createFileRoute("/_authenticated/operacional/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

type Tarefa = Awaited<ReturnType<typeof listarTarefas>>[number];

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  
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

const GRUPOS: Array<{
  id: string;
  titulo: string;
  match: (s: string) => boolean;
  accent: string;
  icon: typeof CircleDot;
}> = [
  {
    id: "aberta",
    titulo: "A fazer",
    match: (s) => s === "aberta",
    accent: "var(--primary)",
    icon: CircleDot,
  },
  {
    id: "em_andamento",
    titulo: "Em andamento",
    match: (s) => s === "em_andamento",
    accent: "var(--warning)",
    icon: Loader2,
  },
  {
    id: "concluida",
    titulo: "Concluídas",
    match: (s) => s === "concluida" || s === "cancelada",
    accent: "var(--success)",
    icon: CheckCircle2,
  },
];

function Pagina() {
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState("");
  const [prioridade, setPrioridade] = useState<string>("todas");
  const [ordem, setOrdem] = useState<"recentes" | "prazo" | "prioridade" | "alfabetica">(
    "recentes",
  );

  const [sel, setSel] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);
  const excluir = useServerFn(excluirTarefa);
  const concluir = useServerFn(concluirTarefa);
  const mover = useServerFn(moverStatusTarefa);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["tarefas", escopo, q],
    queryFn: () => listarTarefas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

  const stats = useMemo(() => {
    const agora = new Date();
    const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).getTime();
    const abertasList = itens.filter(
      (t) => t.status !== "concluida" && t.status !== "cancelada",
    );
    const vencidas = itens.filter((t) => vencida(t.prazo, t.status)).length;
    const hoje = abertasList.filter(
      (t) => t.prazo && !vencida(t.prazo, t.status) && new Date(t.prazo).getTime() <= fimHoje,
    ).length;
    const concluidas = itens.filter((t) => t.status === "concluida").length;
    return {
      total: itens.length,
      abertas: itens.filter((t) => t.status === "aberta").length,
      andamento: itens.filter((t) => t.status === "em_andamento").length,
      hoje,
      vencidas,
      concluidas,
      taxaConclusao: itens.length ? Math.round((concluidas / itens.length) * 100) : 0,
    };
  }, [itens]);


  const grupos = useMemo(() => {
    const peso: Record<string, number> = { p1: 0, p2: 1, p3: 2 };
    const base = itens.filter((t) => prioridade === "todas" || t.prioridade === prioridade);
    const ordenados = [...base].sort((a, b) => {
      if (ordem === "prioridade") return (peso[a.prioridade] ?? 9) - (peso[b.prioridade] ?? 9);
      if (ordem === "alfabetica") return a.titulo.localeCompare(b.titulo);
      if (ordem === "prazo") {
        const va = a.prazo ? new Date(a.prazo).getTime() : Infinity;
        const vb = b.prazo ? new Date(b.prazo).getTime() : Infinity;
        return va - vb;
      }
      return 0;
    });
    return GRUPOS.map((g) => ({
      ...g,
      tarefas: ordenados.filter((t) => g.match(t.status)),
    }));
  }, [itens, prioridade, ordem]);


  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Tarefa excluída.");
      refetch();
    } catch {
      toast.error("Não foi possível excluir a tarefa.");
    }
  }

  async function toggle(t: Tarefa) {
    if (alternando) return;
    const concluida = t.status === "concluida" || t.status === "cancelada";
    setAlternando(t.id);
    try {
      if (concluida) {
        await mover({ data: { id: t.id, status: "aberta" } });
        toast.success("Tarefa reaberta.");
      } else {
        await concluir({ data: { id: t.id } });
        toast.success("Tarefa concluída.");
      }
      await refetch();
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    } finally {
      setAlternando(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <OpHero
        icon={<ListChecks className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Tarefas"
        descricao="Sua lista de trabalho — marque como concluída ao finalizar cada item."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas/calendario">
                <CalendarDays className="mr-1.5 h-4 w-4" /> Calendário
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas/kanban">
                <KanbanSquare className="mr-1.5 h-4 w-4" /> Kanban
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-card/60 backdrop-blur"
              disabled={itens.length === 0}
              onClick={async () => {
                try {
                  await baixarTarefasPDF({
                    tarefas: itens,
                    escopo: escopo === "minhas" ? "Minhas tarefas" : "Todas as tarefas",
                  });
                  toast.success("PDF gerado com sucesso.");
                } catch {
                  toast.error("Não foi possível gerar o PDF.");
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
            </Button>
            <NovaTarefaDialog onCriada={refetch} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <OpStat
          label="Total"
          value={stats.total}
          hint={`${stats.abertas + stats.andamento} em aberto`}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <OpStat
          label="A fazer"
          value={stats.abertas}
          icon={<CircleDot className="h-5 w-5" />}
          accent="var(--primary)"
        />
        <OpStat
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-5 w-5" />}
          accent="var(--warning)"
        />
        <OpStat
          label="Para hoje"
          value={stats.hoje}
          hint="Prazo até o fim do dia"
          icon={<Clock className="h-5 w-5" />}
          accent="var(--warning)"
          alerta={stats.hoje > 0}
        />
        <OpStat
          label="Vencidas"
          value={stats.vencidas}
          hint="Prazo ultrapassado"
          icon={<Clock className="h-5 w-5" />}
          accent="var(--destructive)"
          alerta={stats.vencidas > 0}
        />
        <OpStat
          label="Conclusão"
          value={`${stats.taxaConclusao}%`}
          hint={`${stats.concluidas} concluídas`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="var(--success)"
        />
      </div>


      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
          <TabsList className="h-10 rounded-xl">
            <TabsTrigger value="minhas" className="rounded-lg">Minhas</TabsTrigger>
            <TabsTrigger value="todas" className="rounded-lg">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, código ou responsável…"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="h-10 w-[168px] rounded-xl">
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
        <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
          <SelectTrigger className="h-10 w-[176px] rounded-xl">
            <ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="prazo">Prazo mais próximo</SelectItem>
            <SelectItem value="prioridade">Maior prioridade</SelectItem>
            <SelectItem value="alfabetica">Título (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>


      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-14 text-center shadow-card">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma tarefa encontrada</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Crie uma nova tarefa para organizar o trabalho da equipe.
          </p>
        </div>
      ) : (
        <TarefasBoard
          grupos={grupos}
          alternando={alternando}
          onSelecionar={setSel}
          onToggle={(t) => toggle(t as Tarefa)}
          onStatus={async (t, status) => {
            if (alternando) return;
            setAlternando(t.id);
            try {
              await mover({ data: { id: t.id, status: status as any } });
              await refetch();
            } catch {
              toast.error("Não foi possível atualizar o status.");
            } finally {
              setAlternando(null);
            }
          }}
          onExcluir={handleExcluir}
        />
      )}


      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
