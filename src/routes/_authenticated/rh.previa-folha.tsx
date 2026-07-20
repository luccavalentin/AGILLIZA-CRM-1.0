import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, Lock, CheckCircle2, Plus, Trash2, Pencil } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import {
  fecharCompetencia,
  listarCompetencias,
  previaFolha,
  listarAjustes,
  salvarAjuste,
  excluirAjuste,
  type StatusCompetencia,
  type FolhaItem,
} from "@/lib/rh/folha.functions";
import { formatBRL } from "@/lib/financeiro/format";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const STATUS_TONE: Record<StatusCompetencia, string> = {
  aberta: "bg-muted text-muted-foreground",
  conferida: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  fechada: "bg-primary/15 text-primary",
  cancelada: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/rh/previa-folha")({
  head: () => ({ meta: [{ title: "Prévia da folha — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.previa_folha"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnPrevia = useServerFn(previaFolha);
  const fnCompetencias = useServerFn(listarCompetencias);
  const fnFechar = useServerFn(fecharCompetencia);
  const fnListarAjustes = useServerFn(listarAjustes);
  const fnSalvarAjuste = useServerFn(salvarAjuste);
  const fnExcluirAjuste = useServerFn(excluirAjuste);

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [openFechar, setOpenFechar] = useState(false);
  const [venc, setVenc] = useState(() => {
    const d = new Date();
    d.setDate(5);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [observacoes, setObservacoes] = useState("");

  // Estado do painel de ajustes
  const [ajustesFunc, setAjustesFunc] = useState<FolhaItem | null>(null);
  const [ajusteForm, setAjusteForm] = useState({
    tipo: "provento" as "provento" | "desconto",
    descricao: "",
    valor: 0,
    id: undefined as string | undefined,
  });

  const previa = useQuery({
    queryKey: ["rh-previa-folha", mes, ano],
    queryFn: () => fnPrevia({ data: { mes, ano } }),
  });

  const historico = useQuery({
    queryKey: ["rh-competencias"],
    queryFn: () => fnCompetencias(),
  });

  const ajustes = useQuery({
    queryKey: ["rh-ajustes", mes, ano, ajustesFunc?.funcionario_id],
    enabled: !!ajustesFunc,
    queryFn: () =>
      fnListarAjustes({
        data: { mes, ano, funcionario_id: ajustesFunc!.funcionario_id },
      }),
  });

  const fechar = useMutation({
    mutationFn: () =>
      fnFechar({ data: { mes, ano, vencimento: venc, observacoes: observacoes || null } }),
    onSuccess: (res) => {
      toast.success(`Competência fechada. ${res.contas} contas criadas no financeiro.`);
      qc.invalidateQueries({ queryKey: ["rh-competencias"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setOpenFechar(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao fechar competência."),
  });

  const salvarAj = useMutation({
    mutationFn: async () => {
      if (!ajustesFunc) return;
      if (!ajusteForm.descricao.trim()) throw new Error("Informe a descrição.");
      if (ajusteForm.valor <= 0) throw new Error("Valor deve ser maior que zero.");
      await fnSalvarAjuste({
        data: {
          id: ajusteForm.id,
          funcionario_id: ajustesFunc.funcionario_id,
          mes,
          ano,
          tipo: ajusteForm.tipo,
          descricao: ajusteForm.descricao.trim(),
          valor: ajusteForm.valor,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ajuste salvo.");
      setAjusteForm({ tipo: "provento", descricao: "", valor: 0, id: undefined });
      qc.invalidateQueries({ queryKey: ["rh-ajustes"] });
      qc.invalidateQueries({ queryKey: ["rh-previa-folha", mes, ano] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar ajuste."),
  });

  const removerAj = useMutation({
    mutationFn: (id: string) => fnExcluirAjuste({ data: { id } }),
    onSuccess: () => {
      toast.success("Ajuste removido.");
      qc.invalidateQueries({ queryKey: ["rh-ajustes"] });
      qc.invalidateQueries({ queryKey: ["rh-previa-folha", mes, ano] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  const totais = useMemo(
    () =>
      (previa.data ?? []).reduce(
        (acc, i) => {
          acc.proventos += i.proventos;
          acc.descontos += i.descontos;
          acc.liquido += i.liquido;
          return acc;
        },
        { proventos: 0, descontos: 0, liquido: 0 },
      ),
    [previa.data],
  );

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];
  const jaFechada = (historico.data ?? []).some(
    (c) => c.mes === mes && c.ano === ano && c.status === "fechada",
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <ClipboardList className="h-5 w-5 text-primary" /> Prévia da folha
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolida salários, benefícios, descontos e ajustes avulsos por competência.
          </p>
        </div>
        <Button
          onClick={() => setOpenFechar(true)}
          disabled={jaFechada || !previa.data || previa.data.length === 0}
        >
          {jaFechada ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Já fechada
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" /> Fechar competência
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <YearPicker value={ano} onChange={setAno} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Prévia · {MESES[mes - 1]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead className="text-right">Benefícios</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Ajustes</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previa.data ?? []).map((i) => {
                  const ajProv = i.detalhes.proventos_avulsos ?? 0;
                  const ajDesc = i.detalhes.descontos_avulsos ?? 0;
                  const saldoAj = ajProv - ajDesc;
                  return (
                    <TableRow key={i.funcionario_id}>
                      <TableCell className="font-medium">{i.funcionario_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.cargo ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatBRL(i.salario_base)}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatBRL(i.detalhes.beneficios_valor)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatBRL(i.detalhes.beneficios_desconto + i.detalhes.descontos_lancados)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{formatBRL(i.detalhes.adiantamentos)}
                      </TableCell>
                      <TableCell className={`text-right ${saldoAj > 0 ? "text-emerald-600" : saldoAj < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {saldoAj === 0 ? "—" : (saldoAj > 0 ? "+" : "") + formatBRL(saldoAj)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatBRL(i.liquido)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={jaFechada}
                          onClick={() => {
                            setAjustesFunc(i);
                            setAjusteForm({ tipo: "provento", descricao: "", valor: 0, id: undefined });
                          }}
                          title="Ajustes avulsos"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!previa.data || previa.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum funcionário ativo nesta competência.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {previa.data && previa.data.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Totais</TableCell>
                    <TableCell colSpan={2} className="text-right">
                      Proventos: {formatBRL(totais.proventos)}
                    </TableCell>
                    <TableCell colSpan={3} className="text-right">
                      Descontos: {formatBRL(totais.descontos)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatBRL(totais.liquido)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competências anteriores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Fechada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(historico.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{MESES[c.mes - 1]}/{c.ano}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(c.total_proventos)}</TableCell>
                    <TableCell className="text-right">{formatBRL(c.total_descontos)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(c.total_liquido)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.fechada_em ? new Date(c.fechada_em).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!historico.data || historico.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma competência fechada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de ajustes por funcionário */}
      <Dialog open={!!ajustesFunc} onOpenChange={(o) => !o && setAjustesFunc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Ajustes avulsos · {ajustesFunc?.funcionario_nome} · {MESES[mes - 1]}/{ano}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border border-border/60 bg-muted/30 p-3 sm:grid-cols-[140px_1fr_140px_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={ajusteForm.tipo}
                  onValueChange={(v) => setAjusteForm((p) => ({ ...p, tipo: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="provento">Provento (+)</SelectItem>
                    <SelectItem value="desconto">Desconto (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={ajusteForm.descricao}
                  onChange={(e) => setAjusteForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex.: Comissão sobre venda, Vale-transporte, Bonificação"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ajusteForm.valor || ""}
                  onChange={(e) => setAjusteForm((p) => ({ ...p, valor: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => salvarAj.mutate()}
                  disabled={salvarAj.isPending}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {ajusteForm.id ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[90px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ajustes.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge className={a.tipo === "provento" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-destructive/15 text-destructive"}>
                          {a.tipo === "provento" ? "Provento" : "Desconto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.descricao}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(a.valor)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setAjusteForm({
                                tipo: a.tipo,
                                descricao: a.descricao,
                                valor: a.valor,
                                id: a.id,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removerAj.mutate(a.id)}
                            disabled={removerAj.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!ajustes.data || ajustes.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum ajuste avulso nesta competência.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAjustesFunc(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Fechar competência {MESES[mes - 1]}/{ano}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O sistema criará uma conta a pagar por funcionário no módulo Financeiro, com o líquido
              e o vencimento informado abaixo. Total: <strong>{formatBRL(totais.liquido)}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>Vencimento das contas a pagar</Label>
              <Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenFechar(false)}>Cancelar</Button>
            <Button onClick={() => fechar.mutate()} disabled={fechar.isPending}>
              Fechar e gerar pagamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
