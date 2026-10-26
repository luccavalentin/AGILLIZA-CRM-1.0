import { Link } from "@tanstack/react-router";
import { CalendarDays, KanbanSquare, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

/** Alternador Lista · Kanban · Calendário, igual nas três telas de Tarefas. */
export function VisoesTarefas({ atual }: { atual: "lista" | "kanban" | "calendario" }) {
  const itens = [
    { id: "lista", rotulo: "Lista", to: "/operacional/tarefas", Icone: ListChecks },
    { id: "kanban", rotulo: "Kanban", to: "/operacional/tarefas/kanban", Icone: KanbanSquare },
    {
      id: "calendario",
      rotulo: "Calendário",
      to: "/operacional/tarefas/calendario",
      Icone: CalendarDays,
    },
  ] as const;
  return (
    <nav
      aria-label="Visões das tarefas"
      className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur"
    >
      {itens.map(({ id, rotulo, to, Icone }) => (
        <Link
          key={id}
          to={to}
          aria-current={atual === id ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition sm:px-3",
            atual === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icone className="h-3.5 w-3.5" aria-hidden />
          <span>{rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
