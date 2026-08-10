/**
 * Aba "Histórico" da página de detalhe da simulação. Extraído sem
 * qualquer alteração visual/funcional para reduzir o tamanho da rota.
 */
import { Card } from "@/components/ui/card";
import { History, CheckCircle2, XCircle, Send, Plus, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

function classificarEvento(descricao: string): {
  icone: typeof CircleDot;
  classe: string;
} {
  const d = (descricao ?? "").toLowerCase();
  if (d.includes("falha") || d.includes("erro") || d.includes("reprov")) {
    return {
      icone: XCircle,
      classe: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }
  if (d.includes("retorno") || d.includes("recebid") || d.includes("aprov") || d.includes("conclu")) {
    return {
      icone: CheckCircle2,
      classe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (d.includes("enviad") || d.includes("envio")) {
    return {
      icone: Send,
      classe: "border-primary/30 bg-primary/10 text-primary",
    };
  }
  if (d.includes("criad") || d.includes("nova") || d.includes("criou")) {
    return {
      icone: Plus,
      classe: "border-primary/30 bg-primary/10 text-primary",
    };
  }
  return {
    icone: CircleDot,
    classe: "border-border bg-muted text-muted-foreground",
  };
}

export function HistoricoTimeline({ historico }: { historico: any[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
        </div>
        {historico.length > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {historico.length} {historico.length === 1 ? "evento" : "eventos"}
          </span>
        )}
      </div>
      {historico.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <ol className="relative px-5 py-5 before:absolute before:left-[26px] before:top-8 before:bottom-8 before:w-px before:bg-border">
          {historico.map((h: any) => {
            const ev = classificarEvento(h.descricao);
            const dt = new Date(h.created_at);
            return (
              <li
                key={h.id}
                className="group relative -mx-2 flex gap-4 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-transform duration-200 group-hover:scale-110",
                    ev.classe,
                  )}
                >
                  <ev.icone className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {h.descricao}
                    </p>
                    {h.ator_nome && (
                      <p className="mt-0.5 text-xs text-muted-foreground">por {h.ator_nome}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    <span className="text-muted-foreground/60">
                      {" · "}
                      {dt.toLocaleTimeString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
