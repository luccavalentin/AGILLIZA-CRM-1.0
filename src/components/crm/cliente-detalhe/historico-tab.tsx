export function HistoricoTab({ historico }: { historico: any[] | undefined }) {
  if ((historico?.length ?? 0) === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos.</p>;
  }
  return (
    <div className="space-y-2">
      {historico!.map((h: any) => (
        <div
          key={h.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
        >
          <span className="text-foreground">{h.descricao}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(h.created_at).toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}
