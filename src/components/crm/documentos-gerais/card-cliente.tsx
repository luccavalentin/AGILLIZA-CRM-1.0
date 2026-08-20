import { FileText, FolderOpen, UserCog } from "lucide-react";
import type { DGCliente } from "@/lib/crm/documentos-gerais.functions";
import {
  formatarDocumento,
  primeiroNome,
  SEM_CORRETOR,
  SEM_IMOB,
  titulo,
  type ModoLista,
} from "./helpers";

/** Card de cliente com etiqueta do usuário que o cadastrou. */
export function CardCliente({
  c,
  onOpen,
  modo = "grid",
  mostrarVinculos,
}: {
  c: DGCliente;
  onOpen: () => void;
  modo?: ModoLista;
  mostrarVinculos?: boolean;
}) {
  const docMasked = formatarDocumento(c.documento);
  const vinculo =
    mostrarVinculos || true
      ? `${c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : SEM_IMOB} · ${c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}`
      : null;

  if (modo === "lista") {
    return (
      <button
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{titulo(c.nome)}</p>
          <p className="truncate text-xs text-muted-foreground">{docMasked ?? vinculo}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <FileText className="h-3 w-3" /> {c.total_documentos}
        </span>
      </button>
    );
  }

  return (
    <button
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      onClick={onOpen}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-primary/60 to-primary/10 transition-transform group-hover:scale-x-100" />
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-inset ring-border/40">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{titulo(c.nome)}</p>
          {docMasked && (
            <p className="mt-0.5 truncate text-xs font-medium text-primary/80">{docMasked}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {c.imobiliaria_nome ? titulo(c.imobiliaria_nome) : SEM_IMOB} ·{" "}
            {c.corretor_nome ? titulo(c.corretor_nome) : SEM_CORRETOR}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> {c.total_documentos} documento(s)
        </span>
        {c.analista_nome && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
            title="Cadastrado por"
          >
            <UserCog className="h-3 w-3" />
            {primeiroNome(c.analista_nome)}
          </span>
        )}
      </div>
    </button>
  );
}

export function Campo({ rotulo, valor }: { rotulo: string; valor: any }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/50">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">
        {valor === null || valor === undefined || valor === "" ? "—" : String(valor)}
      </p>
    </div>
  );
}
