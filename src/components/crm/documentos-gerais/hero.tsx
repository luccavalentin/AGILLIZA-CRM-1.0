import { FileText, Folder, FolderKanban, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aba } from "./helpers";

type Kpis = { pastas: number; documentos: number; clientes: number; itens: number };

export function DocumentosHero({
  kpis,
  onTrocarAba,
}: {
  kpis: Kpis;
  onTrocarAba: (a: Aba) => void;
}) {
  const cards: {
    Icon: typeof Folder;
    label: string;
    valor: number;
    aba: Aba | null;
  }[] = [
    { Icon: Folder, label: "Pastas", valor: kpis.pastas, aba: null },
    { Icon: FileText, label: "Documentos", valor: kpis.documentos, aba: null },
    { Icon: Users, label: "Clientes", valor: kpis.clientes, aba: "cliente" },
    { Icon: FolderKanban, label: "Itens", valor: kpis.itens, aba: null },
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-80 rounded-full opacity-60 blur-3xl"
        style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }}
      />
      <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="inline-block h-1 w-6 rounded-full bg-primary" />
            CRM · Documentos
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground md:text-[28px]">
            Documentos Gerais
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Organizados por Comercial → Imobiliária → Corretor → Cliente, com a
            documentação de cada cliente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[600px]">
          {cards.map(({ Icon, label, valor, aba: destinoAba }) => (
            <button
              key={label}
              type="button"
              onClick={() => destinoAba && onTrocarAba(destinoAba)}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-background/60 p-3.5 text-left backdrop-blur-sm transition-all",
                destinoAba
                  ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/[0.06]"
                  : "cursor-default",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-primary/70"
              />
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex size-7 items-center justify-center rounded-md text-primary"
                  style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </p>
              </div>
              <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {valor.toLocaleString("pt-BR")}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
