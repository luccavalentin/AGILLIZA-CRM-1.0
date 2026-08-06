import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { TrendingUp, Plus } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  listarAlteracoesSalariais,
  registrarAlteracaoSalarial,
} from "@/lib/rh/submodulos.functions";
import { formatBRL } from "@/lib/financeiro/format";

const TIPOS = ["Reajuste anual", "Promoção", "Mérito", "Equiparação", "Correção", "Outro"];

export const Route = createFileRoute("/_authenticated/rh/alteracoes-salariais")({
  head: () => ({ meta: [{ title: "Alterações salariais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.salariais"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarAlteracoesSalariais);
  const fnSalvar = useServerFn(registrarAlteracaoSalarial);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    salario_novo: 0,
    tipo: TIPOS[0],
    motivo: "",
    vigencia: new Date().toISOString().slice(0, 10),
  });

  const q = useQuery({ queryKey: ["rh-alt-sal"], queryFn: () => fnList() });

  const salvar = useMutation({
    mutationFn: () =>
      fnSalvar({
        data: {
          funcionario_id: form.funcionario_id,
          salario_novo: Number(form.salario_novo),
          motivo: form.motivo || null,
          tipo: form.tipo,
          vigencia: form.vigencia,
        },
      }),
    onSuccess: () => {
      toast.success("Alteração registrada.");
      qc.invalidateQueries({ queryKey: ["rh-alt-sal"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      qc.invalidateQueries({ queryKey: ["rh-funcionarios"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <TrendingUp className="h-5 w-5 text-primary" /> Alterações salariais
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de reajustes, promoções e correções. O salário do funcionário é atualizado
            automaticamente na data de vigência.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Registrar alteração
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova alteração salarial</DialogTitle>
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
                  <Label>Novo salário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.salario_novo || ""}
                    onChange={(e) => setForm((p) => ({ ...p, salario_novo: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vigência</Label>
                  <Input
                    type="date"
                    value={form.vigencia}
                    onChange={(e) => setForm((p) => ({ ...p, vigencia: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Textarea
                  rows={3}
                  value={form.motivo}
                  onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => salvar.mutate()} disabled={!form.funcionario_id || salvar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Salário anterior</TableHead>
                  <TableHead>Novo salário</TableHead>
                  <TableHead>Δ</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((r) => {
                  const delta = r.salario_novo - r.salario_anterior;
                  const pct = r.salario_anterior > 0 ? (delta / r.salario_anterior) * 100 : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.funcionario_nome}</TableCell>
                      <TableCell>{r.tipo ?? "—"}</TableCell>
                      <TableCell>{formatBRL(r.salario_anterior)}</TableCell>
                      <TableCell>{formatBRL(r.salario_novo)}</TableCell>
                      <TableCell className={delta >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {delta >= 0 ? "+" : ""}
                        {formatBRL(delta)} ({pct.toFixed(1)}%)
                      </TableCell>
                      <TableCell>{new Date(r.vigencia).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{r.motivo ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {(!q.data || q.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma alteração registrada.
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
