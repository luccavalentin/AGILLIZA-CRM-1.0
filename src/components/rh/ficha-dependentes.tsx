import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listarDependentes,
  salvarDependente,
  excluirDependente,
  type Dependente,
} from "@/lib/rh/funcionarios.functions";

const PARENTESCOS = [
  "Cônjuge",
  "Companheiro(a)",
  "Filho(a)",
  "Enteado(a)",
  "Pai",
  "Mãe",
  "Irmão(ã)",
  "Outro",
];

type Form = {
  id?: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  parentesco: string;
  ir: boolean;
  plano_saude: boolean;
  salario_familia: boolean;
  observacoes: string;
};

const vazio: Form = {
  nome: "",
  cpf: "",
  data_nascimento: "",
  parentesco: PARENTESCOS[0],
  ir: false,
  plano_saude: false,
  salario_familia: false,
  observacoes: "",
};

export function FichaDependentes({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const fnList = useServerFn(listarDependentes);
  const fnSalvar = useServerFn(salvarDependente);
  const fnExcluir = useServerFn(excluirDependente);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(vazio);

  const q = useQuery({
    queryKey: ["rh-dependentes", funcionarioId],
    queryFn: () => fnList({ data: { funcionario_id: funcionarioId } }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome.");
      await fnSalvar({
        data: {
          id: form.id,
          funcionario_id: funcionarioId,
          nome: form.nome.trim(),
          cpf: form.cpf || null,
          data_nascimento: form.data_nascimento || null,
          parentesco: form.parentesco,
          ir: form.ir,
          plano_saude: form.plano_saude,
          salario_familia: form.salario_familia,
          observacoes: form.observacoes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Dependente salvo.");
      qc.invalidateQueries({ queryKey: ["rh-dependentes", funcionarioId] });
      setOpen(false);
      setForm(vazio);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Dependente removido.");
      qc.invalidateQueries({ queryKey: ["rh-dependentes", funcionarioId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
  });

  function abrirNovo() {
    setForm(vazio);
    setOpen(true);
  }
  function abrirEdicao(d: Dependente) {
    setForm({
      id: d.id,
      nome: d.nome,
      cpf: d.cpf ?? "",
      data_nascimento: d.data_nascimento ?? "",
      parentesco: d.parentesco,
      ir: d.ir,
      plano_saude: d.plano_saude,
      salario_familia: d.salario_familia,
      observacoes: d.observacoes ?? "",
    });
    setOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> Dependentes
        </CardTitle>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" /> Novo dependente
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Parentesco</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Benefícios</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.parentesco}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.cpf ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.data_nascimento
                      ? new Date(d.data_nascimento).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {d.ir && <Badge variant="secondary">IRRF</Badge>}
                      {d.plano_saude && <Badge variant="secondary">Plano</Badge>}
                      {d.salario_familia && <Badge variant="secondary">Sal. família</Badge>}
                      {!d.ir && !d.plano_saude && !d.salario_familia && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdicao(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover ${d.nome}?`)) remover.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!q.data || q.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum dependente cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar dependente" : "Novo dependente"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome completo</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parentesco</Label>
              <Select
                value={form.parentesco}
                onValueChange={(v) => setForm((p) => ({ ...p, parentesco: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARENTESCOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input
                value={form.cpf}
                onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm((p) => ({ ...p, data_nascimento: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Benefícios elegíveis</Label>
              <div className="flex flex-wrap gap-4 rounded-md border border-border/60 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.ir}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, ir: v === true }))}
                  />
                  Dedução de IRRF
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.plano_saude}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, plano_saude: v === true }))}
                  />
                  Plano de saúde
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.salario_familia}
                    onCheckedChange={(v) =>
                      setForm((p) => ({ ...p, salario_familia: v === true }))
                    }
                  />
                  Salário-família
                </label>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {form.id ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
