import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listarExportacoes } from "@/lib/relatorios/reports.functions";
import { formatData } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/relatorios/exportacoes")({
  head: () => ({ meta: [{ title: "Exportações — Relatórios — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const fn = useServerFn(listarExportacoes);
  const { data, isLoading } = useQuery({
    queryKey: ["report-exports"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <header className="border-b border-border pb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Relatórios · Exportações
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-foreground">
          Histórico de exportações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Relatórios exportados em PDF/XLSX. Reexecute com os mesmos filtros para gerar novamente.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma exportação registrada ainda.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Relatório
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Formato
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Registros
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Data
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((e: any, i: number) => (
                <tr
                  key={e.id}
                  className={
                    i % 2 === 1 ? "border-t border-border bg-muted/25" : "border-t border-border"
                  }
                >
                  <td className="px-3 py-2 font-medium text-foreground">{e.report_codigo}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="uppercase">
                      {e.formato}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                    {Number(e.registros).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatData(e.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/relatorios/${e.report_codigo}` as any}
                      search={(e.filtros ?? {}) as any}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <RotateCw className="h-3 w-3" /> Reexecutar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
