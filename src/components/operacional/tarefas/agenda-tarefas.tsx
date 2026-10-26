/**
 * Agenda de tarefas no desenho das Tarefas do Agilliza Tech (C35):
 * criação rápida por frase (com prévia do que vai ser entendido) e os grupos por
 * quando — atrasadas, hoje, próximos 7 dias, mais adiante, sem data, concluídas —
 * cada um num cartão, com o círculo de concluir em cada linha.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Clock, ListChecks, Loader2, PencilLine, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpretarFrase } from "@/lib/operacional/frase-tarefa";
import {
  agruparAgenda,
  rotuloTipoTarefa,
  estaAberta,
  type GrupoAgenda,
} from "@/lib/operacional/agenda-tarefas";
import type { TarefaItem } from "@/lib/operacional/tarefas.functions";
import { IconeTipoTarefa } from "./icone-tipo-tarefa";
import { OpAvatar, PriorityChip } from "@/components/operacional/ui";
import type { Prioridade } from "@/components/operacional/status";
import { cn } from "@/lib/utils";

export function fmtDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ───────────────────────── Criação rápida ───────────────────────── */

export function CriacaoRapida({
  onCriar,
  desabilitado,
}: {
  /** Recebe o que foi entendido; devolve quando a tarefa foi gravada. */
  onCriar: (t: { titulo: string; tipo: string; prazo: string | null }) => Promise<void>;
  desabilitado?: boolean;
}) {
  const [frase, setFrase] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A prévia usa a MESMA função que monta a tarefa: o que aparece é o que será gravado.
  const previa = useMemo(() => {
    const t = frase.trim();
    return t.length >= 3 ? interpretarFrase(t, new Date()) : null;
  }, [frase]);

  async function criar() {
    const t = frase.trim();
    if (t.length < 3) return setErro("Escreva o que precisa ser feito.");
    const r = interpretarFrase(t, new Date());
    setCriando(true);
    setErro(null);
    try {
      await onCriar({ titulo: r.titulo, tipo: r.tipo, prazo: r.quando ? r.quando.toISOString() : null });
      setFrase("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a tarefa.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <section
      aria-label="Criar tarefa pela frase"
      className="rounded-2xl border border-border/70 bg-card p-3 shadow-card sm:p-3.5"
    >
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <span
          aria-hidden
          className="hidden size-10 shrink-0 place-items-center rounded-xl border border-border/70 text-primary shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_60%,transparent)] sm:grid"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--primary) 12%, var(--card)), var(--card))",
          }}
        >
          <PencilLine className="h-4 w-4" />
        </span>
        <label className="flex h-12 min-w-0 flex-[1_1_260px] items-center rounded-xl border border-border/70 bg-background px-3.5 transition focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]">
          <span className="sr-only">Criar tarefa pela frase</span>
          <input
            value={frase}
            disabled={desabilitado || criando}
            onChange={(e) => setFrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && frase.trim()) {
                e.preventDefault();
                void criar();
              }
            }}
            maxLength={300}
            placeholder="Escreva e pressione Enter: “ligar para Maria amanhã às 10h”"
            autoComplete="off"
            className="h-full w-full min-w-0 border-0 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/80"
          />
        </label>
        <Button
          variant="secondary"
          className="h-10 rounded-xl"
          disabled={desabilitado || criando || frase.trim().length < 3}
          onClick={() => void criar()}
        >
          {criando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Criar
        </Button>
      </div>
      <div className="mt-2 flex min-h-7 flex-wrap items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground" aria-live="polite">
        {previa ? (
          <>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 font-semibold text-primary">
              <IconeTipoTarefa tipo={previa.tipo} className="h-3.5 w-3.5" />
              {rotuloTipoTarefa(previa.tipo)}
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 font-semibold tabular-nums text-primary">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {previa.quando ? fmtDataHora(previa.quando.toISOString()) : "sem data"}
            </span>
            <span className="inline-block h-7 max-w-full truncate rounded-full border border-primary/20 bg-card px-2.5 leading-[26px] text-foreground">
              {previa.titulo}
            </span>
          </>
        ) : (
          <span>
            Entende “hoje”, “amanhã”, “depois de amanhã”, “semana que vem”, datas como 23/10 e horas
            como “às 10h”.
          </span>
        )}
      </div>
      {erro && <p className="mt-1 px-1 text-[12.5px] text-destructive">{erro}</p>}
    </section>
  );
}

/* ───────────────────────── Grupos ───────────────────────── */

export function GruposAgenda({
  tarefas,
  alternando,
  onAbrir,
  onAlternar,
  onExcluir,
}: {
  tarefas: TarefaItem[];
  alternando: string | null;
  onAbrir: (id: string) => void;
  onAlternar: (t: TarefaItem) => void;
  onExcluir?: (id: string) => void;
}) {
  const grupos = useMemo(() => agruparAgenda(tarefas, new Date()), [tarefas]);
  if (grupos.length === 0) return null;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {grupos.map((g) => (
        <CartaoGrupo
          key={g.chave}
          grupo={g}
          alternando={alternando}
          onAbrir={onAbrir}
          onAlternar={onAlternar}
          onExcluir={onExcluir}
        />
      ))}
    </div>
  );
}

function CartaoGrupo({
  grupo,
  alternando,
  onAbrir,
  onAlternar,
  onExcluir,
}: {
  grupo: GrupoAgenda<TarefaItem>;
  alternando: string | null;
  onAbrir: (id: string) => void;
  onAlternar: (t: TarefaItem) => void;
  onExcluir?: (id: string) => void;
}) {
  return (
    <section
      id={`tarefas-${grupo.chave}`}
      aria-labelledby={`tarefas-${grupo.chave}-titulo`}
      className={cn(
        "scroll-mt-24 self-start rounded-2xl border border-border/70 bg-card p-3 shadow-card sm:p-4",
        grupo.chave === "feitas" && "xl:col-span-2",
      )}
    >
      <header className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <h2 id={`tarefas-${grupo.chave}-titulo`} className="text-[14.5px] font-semibold text-foreground">
          {grupo.rotulo}
        </h2>
        <span
          className={cn(
            "min-w-7 rounded-full px-2 py-0.5 text-center text-[11px] font-bold tabular-nums ring-1 ring-inset",
            grupo.tom === "perigo"
              ? "bg-destructive/10 text-destructive ring-destructive/25"
              : grupo.tom === "marca"
                ? "bg-primary/10 text-primary ring-primary/25"
                : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {grupo.tarefas.length}
        </span>
      </header>
      <ul className="grid gap-1.5 rounded-xl bg-muted/45 p-1.5">
        {grupo.tarefas.map((t) => (
          <Linha
            key={t.id}
            t={t}
            ocupada={alternando === t.id}
            onAbrir={() => onAbrir(t.id)}
            onAlternar={() => onAlternar(t)}
            onExcluir={onExcluir ? () => onExcluir(t.id) : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

function Linha({
  t,
  ocupada,
  onAbrir,
  onAlternar,
  onExcluir,
}: {
  t: TarefaItem;
  ocupada: boolean;
  onAbrir: () => void;
  onAlternar: () => void;
  onExcluir?: () => void;
}) {
  const feita = t.status === "concluida";
  const fechada = !estaAberta(t.status);
  const atrasada = !fechada && t.prazo && new Date(t.prazo).getTime() < Date.now();
  const mostraPrioridade = t.prioridade !== "p2" && !fechada;
  return (
    <li
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border border-transparent bg-card px-2.5 py-2 shadow-[0_1px_0_color-mix(in_oklab,var(--border)_70%,transparent)] transition hover:border-border",
        fechada && "opacity-70",
      )}
    >
      <button
        type="button"
        disabled={ocupada || t.status === "cancelada"}
        aria-label={feita ? "Reabrir tarefa" : "Concluir tarefa"}
        aria-pressed={feita}
        onClick={onAlternar}
        className={cn(
          "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] active:scale-90 disabled:cursor-not-allowed",
          feita
            ? "border-success bg-success text-white"
            : "border-border text-transparent hover:border-success hover:text-success/70",
        )}
      >
        {ocupada ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <Check className="h-[13px] w-[13px]" strokeWidth={2.25} aria-hidden />
        )}
      </button>

      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block truncate text-[13.5px] font-medium text-foreground",
            fechada && "line-through decoration-muted-foreground/50",
          )}
        >
          {t.titulo}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <IconeTipoTarefa tipo={t.tipo} className="h-3.5 w-3.5" />
            {rotuloTipoTarefa(t.tipo)}
          </span>
          {t.prazo && (
            <span className={cn(atrasada && "font-semibold text-destructive")}>
              {fmtDataHora(t.prazo)}
            </span>
          )}
          {t.duracao_min ? <span>{t.duracao_min} min</span> : null}
          {t.n_checklist > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" aria-label="Checklist" />
              {t.n_checklist_feitos}/{t.n_checklist}
            </span>
          )}
          {t.recorrencia && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" aria-hidden /> repete
            </span>
          )}
          {t.status === "cancelada" && <span>cancelada</span>}
          {t.numero && <span className="hidden sm:inline">{t.numero}</span>}
        </span>
      </button>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1.5">
          {mostraPrioridade && <PriorityChip prioridade={t.prioridade as Prioridade} />}
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              aria-label="Excluir tarefa"
              className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {t.cliente_id && t.nome_cliente && (
            <Link
              to="/crm/clientes/$id"
              params={{ id: t.cliente_id }}
              className="hidden max-w-[9rem] truncate text-[11.5px] font-medium text-primary hover:underline sm:inline"
            >
              {t.nome_cliente}
            </Link>
          )}
          {t.nome_responsavel && <OpAvatar nome={t.nome_responsavel} className="size-6" />}
        </span>
      </span>
    </li>
  );
}
