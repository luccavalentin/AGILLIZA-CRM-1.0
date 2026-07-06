import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPainel } from "@/lib/crm/clientes.functions";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>
  ),
});

function Pagina() {
  usePipelineRealtime();
  const navigate = useNavigate();
  const listar = useServerFn(listarPainel);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["crm-painel", desde, ate],
    queryFn: () => listar({ data: { desde: desde || undefined, ate: ate || undefined } }),
  });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Painel da esteira</h1>
          <p className="text-sm text-muted-foreground">
            Visão das 12 etapas. A esteira avança automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="w-40"
            />
          </div>
          {(desde || ate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDesde("");
                setAte("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data!.map((stage, idx) => {
            const hue = `var(--pipe-${(idx % 14) + 1})`;
            const temClientes = stage.clientes.length > 0;
            return (
              <div
                key={stage.codigo}
                className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                style={{
                  background: `linear-gradient(180deg, color-mix(in srgb, ${hue} 7%, var(--card)) 0%, var(--card) 55%)`,
                }}
              >
                <div className="h-1.5 w-full" style={{ background: hue }} />
                <div className="flex min-w-0 flex-col p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                        style={{ background: hue }}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {stage.nome}
                      </span>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        color: temClientes ? "#fff" : "var(--muted-foreground)",
                        background: temClientes
                          ? hue
                          : "color-mix(in srgb, var(--muted-foreground) 12%, transparent)",
                      }}
                    >
                      {stage.clientes.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {!temClientes ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                        Nenhum cliente
                      </p>
                    ) : (
                      stage.clientes.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            navigate({ to: "/crm/clientes/$id", params: { id: c.id } })
                          }
                          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
                          style={{ borderLeft: `3px solid ${hue}` }}
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: hue }}
                          >
                            {c.nome.trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {c.nome}
                            </span>
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {c.numero_cliente}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

