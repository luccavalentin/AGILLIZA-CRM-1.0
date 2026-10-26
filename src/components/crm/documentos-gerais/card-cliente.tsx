/** Campo rotulado da ficha consolidada (rótulo pequeno em cima, valor embaixo). */
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
