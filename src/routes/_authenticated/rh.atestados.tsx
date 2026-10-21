import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarOcorrencias } from "@/lib/rh/submodulos.functions";
import { formatData } from "@/lib/financeiro/format";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";

export const Route = createFileRoute("/_authenticated/rh/atestados")({
  head: () => ({ meta: [{ title: "Atestados — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.ocorrencias"),
  component: Pagina,
});

function Pagina() {
  const fn = useServerFn(listarOcorrencias);
  const q = useQuery({
    queryKey: ["rh-atestados"],
    queryFn: () => fn({ data: { tipo: "atestado" } }),
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <FileText className="h-5 w-5 text-primary" /> Atestados médicos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão filtrada apenas dos atestados. O registro fica em Faltas e ocorrências.
          </p>
        </div>
        <Button asChild>
          <Link to="/rh/faltas-ocorrencias" search={{ novo: "atestado" }}>
            Registrar atestado
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>CID</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.funcionario_nome}</TableCell>
                    <TableCell>{formatData(o.data_inicio)}</TableCell>
                    <TableCell>{o.data_fim ? formatData(o.data_fim) : "—"}</TableCell>
                    <TableCell>{o.dias ?? "—"}</TableCell>
                    <TableCell>{o.cid ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {o.justificativa ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!q.data || q.data.length === 0) && (
                  <LinhaEstadoLista colSpan={6} q={q} vazio="Nenhum atestado registrado." />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
