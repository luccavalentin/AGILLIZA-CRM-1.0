import { Check, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtapaCliente } from "@/lib/portal/cliente.functions";

function formatarData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",   day: "2-digit", month: "short" });
}

function formatarDataLonga(iso: string | null) {
  if (!iso) return null;
  // Datas civis (YYYY-MM-DD) sem conversão de fuso.
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function TimelineCliente({ etapas }: { etapas: EtapaCliente[] }) {
  return (
    <ol className="space-y-0">
      {etapas.map((etapa, i) => {
        const ultimo = i === etapas.length - 1;
        return (
          <li key={etapa.ordem} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  etapa.status === "concluida" &&
                    "border-transparent bg-success text-success-foreground",
                  etapa.status === "atual" &&
                    "border-transparent bg-primary text-primary-foreground animate-pulse",
                  etapa.status === "proxima" && "border-border bg-muted text-muted-foreground",
                )}
              >
                {etapa.status === "concluida" ? <Check className="h-4 w-4" /> : etapa.ordem}
              </span>
              {!ultimo && (
                <span
                  className={cn(
                    "w-0.5 flex-1 min-h-6",
                    etapa.status === "concluida" ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("pb-6", ultimo && "pb-0")}>
              <p
                className={cn(
                  "font-medium leading-tight",
                  etapa.status === "atual" ? "text-primary" : "text-foreground",
                  etapa.status === "proxima" && "text-muted-foreground",
                )}
              >
                {etapa.nome}
              </p>
              {etapa.status !== "proxima" && etapa.descricao_cliente && (
                <p className="mt-0.5 text-sm text-muted-foreground">{etapa.descricao_cliente}</p>
              )}
              {etapa.concluida_em && (
                <p className="mt-0.5 text-xs text-success">
                  Concluída em {formatarData(etapa.concluida_em)}
                </p>
              )}
              {etapa.data_marco && (
                <p
                  className={cn(
                    "mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                    etapa.status === "concluida"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatarDataLonga(etapa.data_marco)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
