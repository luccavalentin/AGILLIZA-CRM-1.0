import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPainel } from "@/lib/crm/clientes.functions";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>
  ),
});

function Pagina() {
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data!.map((stage) => (
            <div
              key={stage.codigo}
              className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {stage.nome}
                </span>
                <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {stage.clientes.length}
                </span>
              </div>
              <div className="space-y-2">
                {stage.clientes.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhum cliente
                  </p>
                ) : (
                  stage.clientes.map((c) => (
                    <Card
                      key={c.id}
                      className="cursor-pointer transition-colors hover:border-primary"
                      onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
                    >
                      <CardContent className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {c.numero_cliente}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
