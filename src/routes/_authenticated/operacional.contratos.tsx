import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/crm/tone-badge";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarContratos } from "@/lib/operacional/contratos.functions";

export const Route = createFileRoute("/_authenticated/operacional/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.contratos"),
  component: Pagina,
});

function fmtValor(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Pagina() {
  const listar = useServerFn(listarContratos);
  const { data, isLoading } = useQuery({ queryKey: ["contratos"], queryFn: () => listar() });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Propostas com contrato emitido ou registrado.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum contrato emitido até o momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data!.map((c) => (
            <Link
              key={c.id}
              to="/operacional/propostas/$id"
              params={{ id: c.id }}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:bg-accent"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.numero_proposta ?? "—"}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <span className="font-medium text-foreground">{c.nome_cliente ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{c.nome_banco ?? "—"}</span>
              </div>
              <div className="text-right">
                <span className="block tabular-nums font-semibold text-foreground">
                  {fmtValor(c.valor)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.atualizado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
