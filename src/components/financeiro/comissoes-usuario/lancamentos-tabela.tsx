import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  TIPOS_VINCULO_COMISSAO,
  cancelarComissaoUsuario,
  listarComissoesUsuario,
  marcarComissaoUsuarioPaga,
} from "@/lib/financeiro/comissoes-usuario.functions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge = (s: string) => {
  if (s === "paga") return <Badge className="bg-emerald-500/15 text-emerald-700">Paga</Badge>;
  if (s === "cancelada") return <Badge variant="outline">Cancelada</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700">A pagar</Badge>;
};

export function LancamentosComissoesUsuario() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("todos");
  const [tipoVinculo, setTipoVinculo] = useState<string>("todos");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const filtros = useMemo(
    () => ({
      status: status === "todos" ? undefined : (status as any),
      tipo_vinculo: tipoVinculo === "todos" ? undefined : tipoVinculo,
      de: de || undefined,
      ate: ate || undefined,
    }),
    [status, tipoVinculo, de, ate],
  );

  const { data: rows, isLoading } = useQuery({
    queryKey: ["fin-com-usr-lanc", filtros],
    queryFn: () => listarComissoesUsuario({ data: filtros }),
  });

  const pagar = useMutation({
    mutationFn: (id: string) => marcarComissaoUsuarioPaga({ data: { id } }),
    onSuccess: () => {
      toast.success("Comissão marcada como paga.");
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao pagar."),
  });
  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarComissaoUsuario({ data: { id } }),
    onSuccess: () => {
      toast.success("Comissão cancelada.");
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  const totais = useMemo(() => {
    const list = rows ?? [];
    const somar = (st?: string) =>
      list
        .filter((r) => (st ? r.status === st : true))
        .reduce((a, r) => a + r.valor_comissao, 0);
    return { aPagar: somar("a_pagar"), paga: somar("paga"), total: somar() };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Lançamentos de comissão</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Comissões geradas automaticamente ao emitir cada contrato.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="a_pagar">A pagar</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vínculos</SelectItem>
                  {TIPOS_VINCULO_COMISSAO.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="h-9 w-40"
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
            <Input
              className="h-9 w-40"
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">A pagar</div>
            <div className="text-lg font-semibold">{brl(totais.aPagar)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Pagas</div>
            <div className="text-lg font-semibold text-emerald-600">{brl(totais.paga)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Total no período</div>
            <div className="text-lg font-semibold">{brl(totais.total)}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
          </div>
        ) : !rows?.length ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento no filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.numero_proposta ?? "—"}</TableCell>
                    <TableCell>{r.nome_cliente ?? "—"}</TableCell>
                    <TableCell>{r.usuario_nome ?? "—"}</TableCell>
                    <TableCell className="capitalize">
                      {r.tipo_vinculo.replace("_", " ")}
                    </TableCell>
                    <TableCell>{r.banco_nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{brl(r.valor_base)}</TableCell>
                    <TableCell className="text-right">
                      {r.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {brl(r.valor_comissao)}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "a_pagar" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Marcar como paga"
                            onClick={() => pagar.mutate(r.id)}
                          >
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancelar"
                            onClick={() => cancelar.mutate(r.id)}
                          >
                            <XCircle className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
