import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarPainel } from "@/lib/crm/clientes.functions";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>,
});

function Pagina() {
  const navigate = useNavigate();
  const listar = useServerFn(listarPainel);
  const { data, isLoading } = useQuery({ queryKey: ["crm-painel"], queryFn: () => listar() });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Painel da esteira</h1>
        <p className="text-sm text-muted-foreground">Visão das 12 etapas. A esteira avança automaticamente.</p>
      </div>

      {isLoading ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-64" />)}
        </div>
      ) : (
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-4">
            {data!.map((stage) => (
              <div key={stage.codigo} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm font-medium text-foreground">{stage.nome}</span>
                  <span className="text-xs text-muted-foreground">{stage.clientes.length}</span>
                </div>
                <div className="space-y-2">
                  {stage.clientes.map((c) => (
                    <Card
                      key={c.id}
                      className="cursor-pointer transition-colors hover:border-primary"
                      onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
                    >
                      <CardContent className="p-3">
                        <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                        <p className="font-mono text-xs text-muted-foreground">{c.numero_cliente}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
