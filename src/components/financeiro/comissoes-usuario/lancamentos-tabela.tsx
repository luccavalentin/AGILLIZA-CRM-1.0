import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Trash2,
  Wallet,
  X,
  ArrowUpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  TIPOS_VINCULO_COMISSAO,
  cancelarComissaoUsuario,
  excluirComissoesUsuario,
  listarComissoesUsuario,
  marcarComissaoUsuarioPaga,
  marcarComissoesUsuarioPagas,
} from "@/lib/financeiro/comissoes-usuario.functions";
import { RecalcularComissoesButton } from "./recalcular-button";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { ComissaoEditarDialog, type ComissaoEditavel } from "./comissao-editar-dialog";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge = (s: string) => {
  if (s === "paga") return <Badge className="bg-emerald-500/15 text-emerald-700">Paga</Badge>;
  if (s === "cancelada") return <Badge variant="outline">Cancelada</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700">A pagar</Badge>;
};

export function LancamentosComissoesUsuario({
  usuarioId,
  onLimparUsuario,
}: {
  usuarioId?: string | null;
  onLimparUsuario?: () => void;
} = {}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("todos");
  const [tipoVinculo, setTipoVinculo] = useState<string>("todos");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const filtros = useMemo(
    () => ({
      status: status === "todos" ? undefined : (status as any),
      tipo_vinculo: tipoVinculo === "todos" ? undefined : tipoVinculo,
      usuario_id: usuarioId || undefined,
      de: de || undefined,
      ate: ate || undefined,
    }),
    [status, tipoVinculo, usuarioId, de, ate],
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

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [editando, setEditando] = useState<ComissaoEditavel | null>(null);
  const marcados = new Set(selecionados);

  const excluirLote = useMutation({
    mutationFn: (ids: string[]) => excluirComissoesUsuario({ data: { ids } }),
    onSuccess: (r: any) => {
      toast.success(`${r?.excluidos ?? 0} lançamento(s) excluído(s).`);
      setSelecionados([]);
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  const pagarLote = useMutation({
    mutationFn: (ids: string[]) => marcarComissoesUsuarioPagas({ data: { ids } }),
    onSuccess: () => {
      toast.success("Lançamentos marcados como pagos.");
      setSelecionados([]);
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao pagar."),
  });

  const totais = useMemo(() => {
    const list = rows ?? [];
    const somar = (st?: string) =>
      list.filter((r) => (st ? r.status === st : true)).reduce((a, r) => a + r.valor_comissao, 0);
    const contar = (st?: string) => list.filter((r) => (st ? r.status === st : true)).length;
    return {
      aPagar: somar("a_pagar"),
      paga: somar("paga"),
      total: somar(),
      qtdAPagar: contar("a_pagar"),
      qtdPaga: contar("paga"),
      qtdTotal: contar(),
    };
  }, [rows]);

  const exportColunas = [
    { key: "proposta", label: "Proposta" },
    { key: "cliente", label: "Cliente" },
    { key: "usuario", label: "Usuário" },
    { key: "vinculo", label: "Vínculo" },
    { key: "banco", label: "Banco" },
    {
      key: "base",
      label: "Base",
      align: "right" as const,
      format: "brl" as const,
      footer: "sum" as const,
    },
    { key: "percentual", label: "%", align: "right" as const, format: "pct" as const },
    {
      key: "comissao",
      label: "Comissão",
      align: "right" as const,
      format: "brl" as const,
      footer: "sum" as const,
    },
    { key: "status", label: "Status" },
  ];
  const exportLinhas = (rows ?? []).map((r) => ({
    proposta: r.numero_proposta ?? "—",
    cliente: r.nome_cliente ?? "—",
    usuario: r.usuario_nome ?? "—",
    vinculo: r.tipo_vinculo.replace("_", " "),
    banco: r.banco_nome ?? "—",
    base: Number(r.valor_base) || 0,
    percentual: Number(r.percentual) || 0,
    comissao: Number(r.valor_comissao) || 0,
    status: r.status === "a_pagar" ? "A pagar" : r.status === "paga" ? "Paga" : "Cancelada",
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Lançamentos de comissão</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Comissões geradas automaticamente pelas regras, já vinculadas a contas a pagar.
            </p>
            {usuarioId ? (
              <button
                type="button"
                onClick={onLimparUsuario}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                Filtrando por usuário selecionado — limpar ✕
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <RecalcularComissoesButton className="h-9 py-0" />
            <ExportarFinanceiro
              titulo="Lançamentos de comissão"
              descricao="Comissões por usuário geradas pelas regras vigentes."
              meta={[
                `Status: ${status === "todos" ? "Todos" : status}`,
                `Vínculo: ${tipoVinculo === "todos" ? "Todos" : tipoVinculo}`,
                de || ate ? `Período: ${de || "início"} até ${ate || "hoje"}` : "Período: completo",
              ]}
              kpis={[
                {
                  label: "A pagar",
                  valor: brl(totais.aPagar),
                  hint: `${totais.qtdAPagar} lançamento(s)`,
                  tone: "warning" as const,
                },
                {
                  label: "Pago",
                  valor: brl(totais.paga),
                  hint: `${totais.qtdPaga} lançamento(s)`,
                  tone: "success" as const,
                },
                {
                  label: "Total",
                  valor: brl(totais.total),
                  hint: `${totais.qtdTotal} lançamento(s)`,
                  tone: "brand" as const,
                },
              ]}
              columns={exportColunas}
              rows={exportLinhas}
            />
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
          {[
            {
              rotulo: "A pagar",
              valor: totais.aPagar,
              qtd: totais.qtdAPagar,
              filtro: "a_pagar",
              icon: ArrowUpCircle,
              cor: "text-amber-600",
            },
            {
              rotulo: "Pagas",
              valor: totais.paga,
              qtd: totais.qtdPaga,
              filtro: "paga",
              icon: CheckCircle2,
              cor: "text-emerald-600",
            },
            {
              rotulo: "Total no período",
              valor: totais.total,
              qtd: totais.qtdTotal,
              filtro: "todos",
              icon: Wallet,
              cor: "text-foreground",
            },
          ].map((k) => (
            <button
              key={k.rotulo}
              type="button"
              onClick={() => setStatus(k.filtro)}
              className={`group flex items-start justify-between rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                status === k.filtro ? "border-primary/50 bg-primary/[0.04]" : "border-border"
              }`}
            >
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k.rotulo}
                </div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${k.cor}`}>
                  {brl(k.valor)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {k.qtd} {k.qtd === 1 ? "lançamento" : "lançamentos"}
                </div>
              </div>
              <k.icon className={`size-5 shrink-0 opacity-70 ${k.cor}`} />
            </button>
          ))}
        </div>

        {selecionados.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3">
            <span className="text-sm font-medium">
              {selecionados.length} lançamento(s) selecionado(s)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
                <X className="mr-1.5 size-4" /> Limpar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pagarLote.isPending}
                onClick={() => pagarLote.mutate(selecionados)}
              >
                {pagarLote.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-4" />
                )}
                Marcar como pagas
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={excluirLote.isPending}
                onClick={() => excluirLote.mutate(selecionados)}
              >
                {excluirLote.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-4" />
                )}
                Excluir
              </Button>
            </div>
          </div>
        )}

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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={!!rows.length && rows.every((r) => marcados.has(r.id))}
                      aria-label="Selecionar todos os lançamentos"
                      onCheckedChange={(v) => setSelecionados(v ? rows.map((r) => r.id) : [])}
                    />
                  </TableHead>
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
                  <TableRow
                    key={r.id}
                    className="transition-colors hover:bg-primary/[0.04]"
                    data-state={marcados.has(r.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={marcados.has(r.id)}
                        aria-label="Selecionar lançamento"
                        onCheckedChange={() =>
                          setSelecionados((p) =>
                            p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id],
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.numero_proposta ?? "—"}</TableCell>
                    <TableCell>{r.nome_cliente ?? "—"}</TableCell>
                    <TableCell>{r.usuario_nome ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.tipo_vinculo.replace("_", " ")}</TableCell>
                    <TableCell>
                      {r.banco_nome ? (
                        <span className="flex items-center gap-2">
                          <BancoLogo nome={r.banco_nome} size="xs" />
                          {r.banco_nome}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">{brl(r.valor_base)}</TableCell>
                    <TableCell className="text-right">
                      {r.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {brl(r.valor_comissao)}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar lançamento"
                        onClick={() => setEditando(r as any)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir lançamento"
                        onClick={() => excluirLote.mutate([r.id])}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
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

      <ComissaoEditarDialog lancamento={editando} onOpenChange={(o) => !o && setEditando(null)} />
    </Card>
  );
}
