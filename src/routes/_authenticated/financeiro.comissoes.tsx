import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Percent, RefreshCw } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarComissoes, recalcularComissao } from "@/lib/financeiro/financeiro.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComissaoStatusBadge } from "@/components/financeiro/status-badge";
import { formatBRL } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes")({
  head: () => ({ meta: [{ title: "Repasses — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.comissoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar os repasses.</div>
  ),
});

const STATUS = ["", "a_receber", "recebida", "paga_parceiro"];
const STATUS_LABEL: Record<string, string> = {
  "": "Todos",
  a_receber: "A receber",
  recebida: "Recebidos",
  paga_parceiro: "Pagos parceiro",
};

function Pagina() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["fin-comissoes", status, de, ate],
    queryFn: () =>
      listarComissoes({
        data: { status: status || undefined, de: de || undefined, ate: ate || undefined },
      }),
  });

  const recalc = useMutation({
    mutationFn: (comissao_id: string) => recalcularComissao({ data: { comissao_id } }),
    onSuccess: () => {
      toast.success("Repasse recalculado.");
      qc.invalidateQueries({ queryKey: ["fin-comissoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recalcular."),
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-4 md:p-6">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-foreground">Repasses</h1>
        <p className="text-sm text-muted-foreground">
          Repasses calculados automaticamente a partir dos contratos emitidos, conforme as regras por banco.
        </p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {STATUS.map((s) => (
            <TabsTrigger key={s || "all"} value={s}>
              {STATUS_LABEL[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          De
          <Input type="date" className="w-36 sm:w-40" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          até
          <Input type="date" className="w-36 sm:w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        {(de || ate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDe("");
              setAte("");
            }}
          >
            Limpar
          </Button>
        )}
      </div>


      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Proposta
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Banco
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Valor bruto
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Split parceiro
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Split interno
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Percent className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum repasse calculado ainda.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.map((c) => (
              <TableRow key={c.id} className="even:bg-muted/40 dark:even:bg-muted/60">
                <TableCell className="font-medium">{c.numero_proposta ?? "—"}</TableCell>
                <TableCell>{c.banco_nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(c.valor_bruto)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(c.split_parceiro)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(c.split_interno)}
                </TableCell>
                <TableCell>
                  <ComissaoStatusBadge status={c.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={recalc.isPending}
                    onClick={() => recalc.mutate(c.id)}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Recalcular
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
