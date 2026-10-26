import { mensagemDeErro } from "@/lib/erros/mensagem";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck2,
  Download,
  ListChecks,
  Search,
} from "lucide-react";

import { toast } from "sonner";
import { baixarTarefasPDF } from "@/lib/operacional/pdf-lazy";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import {
  listarTarefas,
  excluirTarefa,
  concluirTarefa,
  criarTarefa,
  moverStatusTarefa,
  type TarefaItem,
} from "@/lib/operacional/tarefas.functions";
import { listarColegas } from "@/lib/operacional/shared.functions";
import {
  LISTA_TIPOS_TAREFA,
  TIPOS_TAREFA,
  metricasAgenda,
} from "@/lib/operacional/agenda-tarefas";
import type { TipoTarefa } from "@/lib/operacional/frase-tarefa";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { VisoesTarefas } from "@/components/operacional/tarefas/visoes-tarefas";
import { CriacaoRapida, GruposAgenda } from "@/components/operacional/tarefas/agenda-tarefas";
import { ROTULO_PRIORIDADE } from "@/components/operacional/status";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * Tarefas do correspondente no desenho das Tarefas dos assinantes (Agilliza Tech, C35):
 * os quatro números do topo, filtros numa faixa, criação rápida por frase e a agenda
 * agrupada por quando. Kanban e calendário continuam (alternador no topo).
 */
function Pagina() {
  // "eu" = só minhas; "todas" = toda a equipe; ou o id de uma pessoa.
  const [responsavel, setResponsavel] = useState<string>("eu");
  const [qDigitado, setQDigitado] = useState("");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [prioridade, setPrioridade] = useState<string>("todas");
  const [sel, setSel] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qDigitado.trim()), 300);
    return () => clearTimeout(t);
  }, [qDigitado]);

  const excluir = useServerFn(excluirTarefa);
  const concluir = useServerFn(concluirTarefa);
  const mover = useServerFn(moverStatusTarefa);
  const criar = useServerFn(criarTarefa);
  // Mesma regra de excluirTarefa: quem cria exclui as próprias; "edit" para a gestão.
  const podeEditarTarefa = usePermissao("operacional.tarefas", "edit");
  const podeCriarTarefa = usePermissao("operacional.tarefas", "create");
  const podeExcluir = podeEditarTarefa || podeCriarTarefa;

  const escopo = responsavel === "eu" ? "minhas" : "todas";
  const responsavelId = responsavel !== "eu" && responsavel !== "todas" ? responsavel : undefined;

  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: ["tarefas", escopo, responsavelId, q, tipo, prioridade],
    queryFn: () =>
      listarTarefas({
        data: {
          escopo,
          responsavel_id: responsavelId,
          q: q || undefined,
          tipo: tipo !== "todos" ? (tipo as TipoTarefa) : undefined,
          prioridade: prioridade !== "todas" ? (prioridade as "p1" | "p2" | "p3") : undefined,
          ordem: "prazo",
        },
      }),
  });
  const itens = useMemo(() => data ?? [], [data]);

  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    staleTime: 5 * 60_000,
  });

  const m = useMemo(() => metricasAgenda(itens, new Date()), [itens]);
  const filtrando = Boolean(q) || tipo !== "todos" || prioridade !== "todas";

  async function handleExcluir(id: string) {
    if (!window.confirm("Excluir esta tarefa? A exclusão fica registrada na auditoria.")) return;
    try {
      await excluir({ data: { id } });
      toast.success("Tarefa excluída.");
      refetch();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível excluir a tarefa."));
    }
  }

  async function alternar(t: TarefaItem) {
    if (alternando) return;
    const fechada = t.status === "concluida";
    setAlternando(t.id);
    try {
      if (fechada) {
        await mover({ data: { id: t.id, status: "aberta" } });
        toast.success("Tarefa reaberta.");
      } else {
        await concluir({ data: { id: t.id } });
        toast.success(t.recorrencia ? "Concluída. A próxima já está na agenda." : "Tarefa concluída.");
      }
      await refetch();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível atualizar a tarefa."));
    } finally {
      setAlternando(null);
    }
  }

  async function criarDaFrase(t: { titulo: string; tipo: string; prazo: string | null }) {
    try {
      await criar({
        data: {
          titulo: t.titulo,
          tipo: t.tipo as TipoTarefa,
          prazo: t.prazo ?? undefined,
          prioridade: "p2",
        },
      });
    } catch (e) {
      throw new Error(mensagemDeErro(e, "Não foi possível criar a tarefa."));
    }
    toast.success("Tarefa criada.");
    await refetch();
  }

  const irPara = (grupo: string, n: number) => () => {
    if (!n) return;
    document.getElementById(`tarefas-${grupo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6">
      <OpHero
        icon={<ListChecks className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Tarefas"
        descricao="Sua agenda de compromissos: o que precisa ser feito e quando. Riscou, concluiu."
        acoes={
          <>
            <VisoesTarefas atual="lista" />
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl bg-card/60 backdrop-blur"
              disabled={itens.length === 0}
              onClick={async () => {
                try {
                  await baixarTarefasPDF({
                    tarefas: itens,
                    escopo: escopo === "minhas" ? "Minhas tarefas" : "Tarefas da equipe",
                  });
                  toast.success("PDF gerado com sucesso.");
                } catch {
                  toast.error("Não foi possível gerar o PDF.");
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            {podeCriarTarefa && <NovaTarefaDialog onCriada={refetch} />}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button type="button" className="text-left" onClick={irPara("atrasadas", m.atrasadas)}>
          <OpStat
            label="Atrasadas"
            value={m.atrasadas}
            hint={m.atrasadas ? "pedem atenção agora" : "nada atrasado"}
            icon={<AlertTriangle className="h-5 w-5" />}
            accent={m.atrasadas ? "var(--destructive)" : "var(--muted-foreground)"}
            alerta={m.atrasadas > 0}
          />
        </button>
        <button type="button" className="text-left" onClick={irPara("hoje", m.hoje)}>
          <OpStat label="Para hoje" value={m.hoje} icon={<CalendarCheck2 className="h-5 w-5" />} />
        </button>
        <button type="button" className="text-left" onClick={irPara("semana", m.semana)}>
          <OpStat
            label="Próximos 7 dias"
            value={m.semana}
            icon={<ListChecks className="h-5 w-5" />}
          />
        </button>
        <button type="button" className="text-left" onClick={irPara("feitas", m.concluidasSemana)}>
          <OpStat
            label="Concluídas na semana"
            value={m.concluidasSemana}
            icon={<BadgeCheck className="h-5 w-5" />}
            accent="var(--success)"
          />
        </button>
      </div>

      <section
        aria-label="Filtros das tarefas"
        className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-card"
      >
        <div className="relative min-w-0 flex-[1_1_240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qDigitado}
            onChange={(e) => setQDigitado(e.target.value)}
            placeholder="Buscar tarefa…"
            maxLength={120}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-[190px]" aria-label="Responsável">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eu">Só minhas</SelectItem>
            <SelectItem value="todas">Toda a equipe</SelectItem>
            {(colegas ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome ?? c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-10 w-[calc(50%-0.35rem)] rounded-xl sm:w-[160px]" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {LISTA_TIPOS_TAREFA.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPOS_TAREFA[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="h-10 w-[calc(50%-0.35rem)] rounded-xl sm:w-[160px]" aria-label="Prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda prioridade</SelectItem>
            <SelectItem value="p1">{ROTULO_PRIORIDADE.p1}</SelectItem>
            <SelectItem value="p2">{ROTULO_PRIORIDADE.p2}</SelectItem>
            <SelectItem value="p3">{ROTULO_PRIORIDADE.p3}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {podeCriarTarefa && <CriacaoRapida onCriar={criarDaFrase} />}

      {isLoading ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
          <p className="text-sm font-medium text-foreground">Não foi possível carregar as tarefas</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {mensagemDeErro(error, "Tente de novo em instantes.")}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-12 text-center shadow-card">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarCheck2 className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {filtrando ? "Nenhuma tarefa com esses filtros" : "Nenhuma tarefa"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {filtrando
              ? "Limpe a busca ou troque o tipo e a prioridade."
              : "Comece agendando a próxima ligação ou reunião: escreva acima e pressione Enter."}
          </p>
        </div>
      ) : (
        <GruposAgenda
          tarefas={itens}
          alternando={alternando}
          onAbrir={setSel}
          onAlternar={alternar}
          onExcluir={podeExcluir ? handleExcluir : undefined}
        />
      )}

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
