import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fecharChatFlutuante } from "@/components/shared/floating-chat-store";

export function Linha({
  icone,
  label,
  children,
}: {
  icone: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-muted-foreground">
        {icone}
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-foreground">
        {children}
      </span>
    </div>
  );
}

export function VinculoRow({
  icone,
  label,
  nome,
  sub,
  to,
}: {
  icone: ReactNode;
  label: string;
  nome: string;
  sub?: string | null;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">{nome}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function StatPill({
  icone,
  valor,
  label,
}: {
  icone: ReactNode;
  valor: string;
  label: string;
}) {
  return (
    <div className="flex min-w-[9rem] flex-1 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-sm sm:flex-none">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight tabular-nums text-foreground">{valor}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ChatFlutuandoAviso({ tipo, id }: { tipo: string; id: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Maximize2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Conversa aberta em janela flutuante</p>
        <p className="text-xs text-muted-foreground">
          Continua disponível enquanto você navega pelo sistema.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => fecharChatFlutuante(tipo, id)}>
        Reacoplar janela
      </Button>
    </div>
  );
}
