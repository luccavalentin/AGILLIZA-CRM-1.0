/** Componente compartilhado para lançamentos por competência (adiantamentos / descontos). */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { YearPicker } from "@/components/rh/year-picker";
import { formatBRL } from "@/lib/financeiro/format";
import type { LancamentoStatus, RhLancamento } from "@/lib/rh/submodulos.functions";

const STATUS: Record<LancamentoStatus, { label: string; tone: string }> = {
  previsto: { label: "Previsto", tone: "bg-muted text-muted-foreground" },
  recebido: { label: "Recebido", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  descontado: { label: "Descontado", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  pago: { label: "Pago", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", tone: "bg-destructive/15 text-destructive" },
};

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function LancamentosPage({
  titulo,
  descricao,
  icon: Icon,
  queryKey,
  listarFn,
  salvarFn,
  labelBotao,
  labelValor,
}: {
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  queryKey: string;
  listarFn: any;
  salvarFn: any;
  labelBotao: string;
  labelValor: string;
}) {
  const qc = useQueryClient();
  const fnList = useServerFn(listarFn);
  const fnSalvar = useServerFn(salvarFn);

  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState<number>(hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState<number>(hoje.getFullYear());

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    data: hoje.toISOString().slice(0, 10),
    valor: 0,
    competencia_mes: hoje.getMonth() + 1,
    competencia_ano: hoje.getFullYear(),
    descricao: "",
    status: "previsto" as LancamentoStatus,
  });

  const q = useQuery({
    queryKey: [queryKey, filtroMes, filtroAno],
    queryFn: () =>
      fnList({ data: { competencia_mes: filtroMes, competencia_ano: filtroAno } }) as Promise<
        RhLancamento[]
      >,
  });

  const salvar = useMutation({
    mutationFn: () => fnSalvar({ data: form }),
    onSuccess: () => {
      toast.success("Lançamento salvo.");
      qc.invalidateQueries({ queryKey: [queryKey] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <Icon className="h-5 w-5 text-primary" /> {titulo}
          </h1>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> {labelBotao}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo lançamento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <FuncionarioPicker
                  value={form.funcionario_id}
                  onChange={(v) => setForm((p) => ({ ...p, funcionario_id: v ?? "" }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{labelValor}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.valor || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, valor: e.target.value === "" ? 0 : Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((p) => ({ ...p, status: v as LancamentoStatus }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as LancamentoStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Competência (mês)</Label>
                  <Select
                    value={String(form.competencia_mes)}
                    onValueChange={(v) => setForm((p) => ({ ...p, competencia_mes: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Competência (ano)</Label>
                  <YearPicker
                    value={form.competencia_ano}
                    onChange={(a) => setForm((p) => ({ ...p, competencia_ano: a }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || !form.funcionario_id || form.valor <= 0}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(filtroMes)} onValueChange={(v) => setFiltroMes(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <YearPicker value={filtroAno} onChange={setFiltroAno} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.funcionario_nome}</TableCell>
                    <TableCell>{new Date(l.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{formatBRL(l.valor)}</TableCell>
                    <TableCell>
                      {MESES[l.competencia_mes - 1]}/{l.competencia_ano}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{l.descricao ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!q.data || q.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum lançamento na competência.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
