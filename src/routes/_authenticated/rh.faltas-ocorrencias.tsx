import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import {
  excluirOcorrencia,
  listarOcorrencias,
  registrarOcorrencia,
  type OcorrenciaTipo,
} from "@/lib/rh/submodulos.functions";
import { OCORRENCIA_LABEL as ROT } from "@/lib/rh/rotulos";
import { formatData, hojeISO } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";

const TIPOS: { value: OcorrenciaTipo; label: string; tone: string }[] = [
  { value: "falta", label: ROT.falta, tone: "bg-destructive/15 text-destructive" },
  {
    value: "atestado",
    label: ROT.atestado,
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    value: "advertencia",
    label: ROT.advertencia,
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  { value: "licenca", label: ROT.licenca, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { value: "suspensao", label: ROT.suspensao, tone: "bg-destructive/15 text-destructive" },
  {
    value: "elogio",
    label: ROT.elogio,
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  { value: "outro", label: ROT.outro, tone: "bg-muted text-muted-foreground" },
];

export const Route = createFileRoute("/_authenticated/rh/faltas-ocorrencias")({
  head: () => ({ meta: [{ title: "Faltas e ocorrências — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.ocorrencias"),
  // `?novo=atestado` (botão "Registrar atestado" da tela de Atestados) já abre
  // o formulário com o tipo escolhido — antes só trazia para esta lista.
  validateSearch: (s: Record<string, unknown>): { novo?: OcorrenciaTipo } =>
    TIPOS.some((t) => t.value === s.novo) ? { novo: s.novo as OcorrenciaTipo } : {},
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarOcorrencias);
  const fnSalvar = useServerFn(registrarOcorrencia);
  const fnExcluir = useServerFn(excluirOcorrencia);

  const [filtroFuncionario, setFiltroFuncionario] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [open, setOpen] = useState(false);
  const formVazio = (tipo: OcorrenciaTipo = "falta") => ({
    funcionario_id: "",
    tipo,
    data_inicio: hojeISO(),
    data_fim: "",
    dias: "",
    cid: "",
    justificativa: "",
    abonada: false,
  });
  const [form, setForm] = useState(() => formVazio());

  // "Registrar" sempre abre limpo: reabria com o que foi digitado na anterior.
  function abrirNovo(tipo: OcorrenciaTipo = "falta") {
    setForm(formVazio(tipo));
    setOpen(true);
  }

  const { novo } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!novo) return;
    abrirNovo(novo);
    navigate({ to: ".", search: {}, replace: true });
  }, [novo]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useQuery({
    queryKey: ["rh-ocorrencias", filtroFuncionario, filtroTipo],
    queryFn: () =>
      fnList({
        data: {
          ...(filtroFuncionario ? { funcionario_id: filtroFuncionario } : {}),
          ...(filtroTipo ? { tipo: filtroTipo } : {}),
        },
      }),
  });

  const salvar = useMutation({
    mutationFn: () =>
      fnSalvar({
        data: {
          funcionario_id: form.funcionario_id,
          tipo: form.tipo,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim || null,
          dias: form.dias ? Number(form.dias) : null,
          cid: form.cid || null,
          justificativa: form.justificativa || null,
          abonada: form.abonada,
        },
      }),
    onSuccess: () => {
      toast.success("Ocorrência registrada.");
      qc.invalidateQueries({ queryKey: ["rh-ocorrencias"] });
      qc.invalidateQueries({ queryKey: ["rh-atestados"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao registrar.")),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => fnExcluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Ocorrência excluída.");
      qc.invalidateQueries({ queryKey: ["rh-ocorrencias"] });
      qc.invalidateQueries({ queryKey: ["rh-atestados"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
    },
    // Erro: o ConfirmDelete mostra a mensagem e continua aberto.
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <AlertTriangle className="h-5 w-5 text-primary" /> Faltas, atestados e ocorrências
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro cronológico das ocorrências do quadro.
          </p>
        </div>
        <Button onClick={() => abrirNovo()}>
          <Plus className="mr-2 h-4 w-4" /> Registrar ocorrência
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova ocorrência</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Funcionário</Label>
                <FuncionarioPicker
                  value={form.funcionario_id}
                  onChange={(v) => setForm((p) => ({ ...p, funcionario_id: v ?? "" }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as OcorrenciaTipo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CID (atestado)</Label>
                <Input
                  value={form.cid}
                  onChange={(e) => setForm((p) => ({ ...p, cid: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dias</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.dias || ""}
                  onChange={(e) => setForm((p) => ({ ...p, dias: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Checkbox
                  id="abonada"
                  checked={form.abonada}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, abonada: !!v }))}
                />
                <Label htmlFor="abonada" className="cursor-pointer">
                  Abonada
                </Label>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Justificativa</Label>
                <Textarea
                  rows={3}
                  value={form.justificativa}
                  onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || !form.funcionario_id}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Funcionário</Label>
            <FuncionarioPicker value={filtroFuncionario} onChange={setFiltroFuncionario} allowAll />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={filtroTipo || "__all__"}
              onValueChange={(v) => setFiltroTipo(v === "__all__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>CID</TableHead>
                  <TableHead>Abonada</TableHead>
                  <TableHead className="w-[60px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lista.data ?? []).map((o) => {
                  const tipo = TIPOS.find((t) => t.value === o.tipo);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.funcionario_nome}</TableCell>
                      <TableCell>
                        <Badge className={tipo?.tone}>{tipo?.label ?? o.tipo}</Badge>
                      </TableCell>
                      <TableCell>{formatData(o.data_inicio)}</TableCell>
                      <TableCell>{o.data_fim ? formatData(o.data_fim) : "—"}</TableCell>
                      <TableCell>{o.dias ?? "—"}</TableCell>
                      <TableCell>{o.cid ?? "—"}</TableCell>
                      <TableCell>{o.abonada ? "Sim" : "Não"}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmDelete
                          titulo="Excluir ocorrência"
                          descricao={`A ocorrência de ${o.funcionario_nome} (${tipo?.label ?? o.tipo}) será excluída.`}
                          onConfirm={async () => {
                            await excluir.mutateAsync(o.id);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!lista.data || lista.data.length === 0) && (
                  <LinhaEstadoLista colSpan={8} q={lista} vazio="Nenhuma ocorrência registrada." />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
