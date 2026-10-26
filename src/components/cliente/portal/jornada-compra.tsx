import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomeEtapa, type EtapaJornada } from "@/lib/portal/jornada";

function dataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
}

/**
 * A linha da compra, do ponto de vista de quem está esperando: as etapas, a de agora
 * marcada, e o que cada uma quer dizer. Etapa que ainda não chegou diz o que vai
 * acontecer — branco parece erro. Mesmo desenho da jornada do portal do cliente do
 * Agilliza Tech, com "Contrato registrado" no fim.
 *
 * `compacta`: só os nomes, em trilho horizontal (início no computador); no celular a
 * lista vertical é sempre a leitura.
 */
export function JornadaCompra({ etapas, compacta = false }: { etapas: EtapaJornada[]; compacta?: boolean }) {
  if (!etapas.length) {
    return <p className="text-sm text-muted-foreground">As etapas aparecem aqui assim que o seu processo começar.</p>;
  }
  return (
    <>
      {compacta && (
        <ol className="hidden grid-flow-col auto-cols-fr gap-1 lg:grid" aria-label="Etapas da compra">
          {etapas.map((e, i) => (
            <li key={e.codigo} className="flex min-w-0 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : e.status === "proxima" ? "bg-border" : "bg-primary/40")} />
                <Marcador e={e} i={i} />
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    i === etapas.length - 1 ? "bg-transparent" : e.status === "concluida" ? "bg-primary/40" : "bg-border",
                  )}
                />
              </div>
              <p
                className={cn(
                  "mt-2 line-clamp-2 px-1 text-[11.5px] font-medium leading-tight",
                  e.status === "proxima" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {nomeEtapa(e.nome)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <ol className={cn("relative", compacta && "lg:hidden")}>
        {etapas.map((e, i) => {
          const ultimo = i === etapas.length - 1;
          const quando = e.status === "concluida" ? dataCurta(e.concluida_em) : dataCurta(e.data_marco ?? null);
          return (
            <li key={e.codigo} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!ultimo && (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 left-[13px] top-8 w-0.5", e.status === "concluida" ? "bg-primary/35" : "bg-border")}
                />
              )}
              <Marcador e={e} i={i} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium leading-tight",
                    e.status === "proxima" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {nomeEtapa(e.nome)}
                  {e.status === "atual" && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-primary">
                      agora
                    </span>
                  )}
                  {quando && <span className="text-xs font-normal text-muted-foreground">{quando}</span>}
                </p>
                {e.descricao_cliente && e.status !== "concluida" && (
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{e.descricao_cliente}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Marcador({ e, i }: { e: EtapaJornada; i: number }) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        e.status === "concluida"
          ? "bg-primary text-primary-foreground shadow-[0_4px_10px_-4px_rgba(0,15,159,0.6)]"
          : e.status === "atual"
            ? "border-2 border-primary bg-background text-primary ring-4 ring-primary/10"
            : "border border-border bg-background text-muted-foreground",
      )}
    >
      {e.status === "concluida" ? <Check className="size-3.5" aria-hidden /> : i + 1}
    </span>
  );
}
