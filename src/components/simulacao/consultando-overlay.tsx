import { Loader2 } from "lucide-react";

/** Overlay exibido enquanto a simulação consulta os bancos. */
export function ConsultandoOverlay({
  aberto,
  total,
  concluidos,
}: {
  aberto: boolean;
  total: number;
  concluidos: number;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-[min(90vw,360px)] flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-semibold text-card-foreground">Consultando bancos…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? `${concluidos} de ${total} bancos processados` : "Preparando envio"}
          </p>
        </div>
      </div>
    </div>
  );
}
