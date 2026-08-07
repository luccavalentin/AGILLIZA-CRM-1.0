import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckSquare, ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarDemandas } from "@/lib/operacional/demandas.functions";
import { listarTarefas } from "@/lib/operacional/tarefas.functions";
import { InteracoesTab } from "@/components/crm/interacoes-tab";

/**
 * Aba do cadastro do cliente que consolida TODAS as atividades vinculadas a ele:
 * demandas, tarefas e interações — servindo como visão 360º do relacionamento.
 */
export function AtividadesClienteTab({ clienteId }: { clienteId: string }) {
  const listarDem = useServerFn(listarDemandas);
  const listarTar = useServerFn(listarTarefas);

  const { data: demandas, isLoading: loadDem } = useQuery({
    queryKey: ["cliente-demandas", clienteId],
    queryFn: () => listarDem({ data: { escopo: "geral", cliente_id: clienteId } }),
  });
  const { data: tarefas, isLoading: loadTar } = useQuery({
    queryKey: ["cliente-tarefas", clienteId],
    queryFn: () => listarTar({ data: { escopo: "todas", cliente_id: clienteId } }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" />
            Demandas vinculadas
            {demandas?.length ? (
              <Badge variant="secondary" className="ml-1">
                {demandas.length}
              </Badge>
            ) : null}
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/operacional/demandas" search={{ cliente: clienteId } as any}>
              Ver todas <ExternalLink className="ml-1 size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadDem ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : !demandas?.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma demanda vinculada a este cliente.
            </p>
          ) : (
            demandas.map((d: any) => (
              <Link
                key={d.id}
                to="/operacional/demandas/$id"
                params={{ id: d.id }}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono uppercase">{d.numero}</span>
                    <span>·</span>
                    <span className="capitalize">{d.prioridade}</span>
                  </div>
                  <p className="truncate text-sm font-medium text-foreground">{d.titulo}</p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {String(d.status).replace(/_/g, " ")}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="size-4 text-primary" />
            Tarefas vinculadas
            {tarefas?.length ? (
              <Badge variant="secondary" className="ml-1">
                {tarefas.length}
              </Badge>
            ) : null}
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/operacional/tarefas">
              Ver todas <ExternalLink className="ml-1 size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadTar ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : !tarefas?.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma tarefa vinculada a este cliente.
            </p>
          ) : (
            tarefas.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono uppercase">{t.numero}</span>
                    {t.prazo && (
                      <>
                        <span>·</span>
                        <span>Prazo {new Date(t.prazo).toLocaleDateString("pt-BR")}</span>
                      </>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium text-foreground">{t.titulo}</p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {String(t.status).replace(/_/g, " ")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registro de interações</CardTitle>
        </CardHeader>
        <CardContent>
          <InteracoesTab clienteId={clienteId} />
        </CardContent>
      </Card>
    </div>
  );
}
