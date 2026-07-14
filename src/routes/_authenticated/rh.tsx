import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rh")({
  head: () => ({
    meta: [{ title: "Gestão de Pessoas e RH — Agilliza" }],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[1400px] flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <UserRound className="h-10 w-10" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Gestão de Pessoas e RH
        </h1>
        <span
          className="inline-flex items-center gap-2 rounded-full border-2 border-yellow-400 bg-yellow-300/90 px-6 py-2 text-lg font-bold uppercase tracking-widest text-yellow-950 shadow-lg animate-pulse"
          role="status"
          aria-live="polite"
        >
          Em breve
        </span>
        <p className="max-w-md text-sm text-muted-foreground">
          Este módulo está em desenvolvimento e ficará disponível em breve.
        </p>
      </div>
    </div>
  );
}
