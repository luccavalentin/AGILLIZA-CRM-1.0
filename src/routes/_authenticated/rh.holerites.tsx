import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Receipt, Upload, Download, FileDown, Sparkles } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  anexarHolerite,
  gerarUrlAssinada,
  listarHolerites,
} from "@/lib/rh/submodulos.functions";
import { listarItensFolha, listarAjustes } from "@/lib/rh/folha.functions";
import { gerarHoleritePdf } from "@/lib/rh/holerite-pdf";
import { formatBRL } from "@/lib/financeiro/format";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const Route = createFileRoute("/_authenticated/rh/holerites")({
  head: () => ({ meta: [{ title: "Holerites — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.holerites"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarHolerites);
  const fnAnexar = useServerFn(anexarHolerite);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const fnListarItens = useServerFn(listarItensFolha);
  const fnListarAjustes = useServerFn(listarAjustes);



  const hoje = new Date();
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear());
  const [filtroMes, setFiltroMes] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "",
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
    valor_liquido: 0,
    file: null as File | null,
  });

  const q = useQuery({
    queryKey: ["rh-holerites", filtroAno, filtroMes],
    queryFn: () =>
      fnList({ data: { ano: filtroAno, ...(filtroMes ? { mes: filtroMes } : {}) } }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.funcionario_id || !form.file) throw new Error("Selecione funcionário e arquivo.");
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sessão expirada.");
      const prof = await supabase
        .from("profiles")
        .select("correspondente_id")
        .eq("id", user.id)
        .maybeSingle();
      const cid = prof.data?.correspondente_id as string | undefined;
      if (!cid) throw new Error("Correspondente não encontrado.");
      const path = `${cid}/holerites/${form.funcionario_id}/${form.ano}-${String(form.mes).padStart(2, "0")}.pdf`;
      const { error } = await supabase.storage
        .from("rh-documentos")
        .upload(path, form.file, {
          contentType: form.file.type || "application/pdf",
          upsert: true,
        });
      if (error) throw new Error(error.message);
      await fnAnexar({
        data: {
          funcionario_id: form.funcionario_id,
          mes: form.mes,
          ano: form.ano,
          arquivo_path: path,
          arquivo_nome: form.file.name,
          valor_liquido: form.valor_liquido || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Holerite anexado.");
      qc.invalidateQueries({ queryKey: ["rh-holerites"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao anexar."),
  });

  async function abrir(path: string) {
    const { url } = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(url, "_blank", "noopener");
  }

  const anos = [hoje.getFullYear() - 2, hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <Receipt className="h-5 w-5 text-primary" /> Holerites e recibos
          </h1>
          <p className="text-sm text-muted-foreground">
            Anexe o PDF do holerite por competência. Cada funcionário recebe um por mês.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" /> Anexar holerite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anexar holerite</DialogTitle>
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
                  <Label>Mês</Label>
                  <Select value={String(form.mes)} onValueChange={(v) => setForm((p) => ({ ...p, mes: Number(v) }))}>
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
                  <Select value={String(form.ano)} onValueChange={(v) => setForm((p) => ({ ...p, ano: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Valor líquido (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_liquido}
                  onChange={(e) => setForm((p) => ({ ...p, valor_liquido: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PDF do holerite</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                Anexar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Select value={String(filtroAno)} onValueChange={(v) => setFiltroAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select
              value={filtroMes ? String(filtroMes) : "__all__"}
              onValueChange={(v) => setFiltroMes(v === "__all__" ? null : Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Competência</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Valor líquido</TableHead>
                  <TableHead className="text-right w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.funcionario_nome}</TableCell>
                    <TableCell>{MESES[h.mes - 1]}/{h.ano}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{h.arquivo_nome}</TableCell>
                    <TableCell>{h.valor_liquido !== null ? formatBRL(h.valor_liquido) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => abrir(h.arquivo_path)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!q.data || q.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum holerite na competência.
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
