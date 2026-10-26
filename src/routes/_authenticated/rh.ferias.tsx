import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Pencil, Plane, Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControleFeriasPanel } from "@/components/rh/controle-ferias-panel";
import { listarFerias, salvarFerias, type FeriasStatus } from "@/lib/rh/submodulos.functions";
import { FERIAS_STATUS_LABEL as ROT } from "@/lib/rh/rotulos";
import { formatData } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { usePermissao } from "@/hooks/use-permissao";

const STATUS: Record<FeriasStatus, { label: string; tone: string }> = {
  planejada: { label: ROT.planejada, tone: "bg-muted text-muted-foreground" },
  aprovada: {
    label: ROT.aprovada,
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  em_curso: { label: ROT.em_curso, tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  concluida: { label: ROT.concluida, tone: "bg-primary/15 text-primary" },
  cancelada: { label: ROT.cancelada, tone: "bg-destructive/15 text-destructive" },
};

export const Route = createFileRoute("/_authenticated/rh/ferias")({
  head: () => ({ meta: [{ title: "Férias — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.ferias"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnList = useServerFn(listarFerias);
  const fnSalvar = useServerFn(salvarFerias);
  // Programar (planejada) e aprovar são permissões separadas; o banco confere de novo.
  const podeAprovar = usePermissao("rh.ferias", "edit");
  const podeCriar = usePermissao("rh.ferias", "create");
  const podeProgramar = podeCriar || podeAprovar;

  const [open, setOpen] = useState(false);
  // Abrir "Programar férias" começa do zero; antes reabria com o último preenchimento.
  const formVazio = () => ({
    id: undefined as string | undefined,
    funcionario_id: "",
    periodo_aquisitivo_inicio: "",
    periodo_aquisitivo_fim: "",
    data_inicio: "",
    data_fim: "",
    dias_gozados: 30,
    abono_dias: 0,
    adiantar_13o: false,
    status: "planejada" as FeriasStatus,
    observacoes: "",
  });
  const [form, setForm] = useState(formVazio);

  const q = useQuery({ queryKey: ["rh-ferias"], queryFn: () => fnList() });

  const salvar = useMutation({
    mutationFn: () =>
      fnSalvar({
        data: {
          id: form.id,
          funcionario_id: form.funcionario_id,
          periodo_aquisitivo_inicio: form.periodo_aquisitivo_inicio,
          periodo_aquisitivo_fim: form.periodo_aquisitivo_fim,
          data_inicio: form.data_inicio || null,
          data_fim: form.data_fim || null,
          dias_gozados: Number(form.dias_gozados),
          abono_dias: Number(form.abono_dias),
          adiantar_13o: form.adiantar_13o,
          status: form.status,
          observacoes: form.observacoes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Período de férias salvo.");
      qc.invalidateQueries({ queryKey: ["rh-ferias"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  // Cancelar mantém o registro (histórico e avos já calculados); só muda o status.
  // Sem try/catch: o ConfirmDelete mostra o erro e continua aberto.
  async function cancelarFerias(f: NonNullable<typeof q.data>[number]) {
    await fnSalvar({
      data: {
        id: f.id,
        funcionario_id: f.funcionario_id,
        periodo_aquisitivo_inicio: f.periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim: f.periodo_aquisitivo_fim,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim,
        dias_gozados: f.dias_gozados,
        abono_dias: f.abono_dias,
        adiantar_13o: f.adiantar_13o,
        status: "cancelada",
        observacoes: f.observacoes,
      },
    });
    toast.success("Férias canceladas.");
    qc.invalidateQueries({ queryKey: ["rh-ferias"] });
    qc.invalidateQueries({ queryKey: ["rh-kpis"] });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <Plane className="h-5 w-5 text-primary" /> Férias
          </h1>
          <p className="text-sm text-muted-foreground">
            Períodos aquisitivos calculados automaticamente pela data de admissão (CLT),
            planejamento e execução das férias.
          </p>
        </div>
        <Button
          disabled={!podeProgramar}
          onClick={() => {
            setForm(formVazio());
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Programar férias
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar férias" : "Programar férias"}</DialogTitle>
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
                <Label>Aquisitivo início</Label>
                <Input
                  type="date"
                  value={form.periodo_aquisitivo_inicio}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, periodo_aquisitivo_inicio: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Aquisitivo fim</Label>
                <Input
                  type="date"
                  value={form.periodo_aquisitivo_fim}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, periodo_aquisitivo_fim: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gozo — início</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gozo — fim</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Dias gozados</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.dias_gozados || ""}
                  onChange={(e) => setForm((p) => ({ ...p, dias_gozados: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Abono (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.abono_dias || ""}
                  onChange={(e) => setForm((p) => ({ ...p, abono_dias: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v as FeriasStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS).map(([k, s]) => (
                      <SelectItem
                        key={k}
                        value={k}
                        disabled={!podeAprovar && ["aprovada", "em_curso", "concluida"].includes(k)}
                      >
                        {s.label}
                        {!podeAprovar && ["aprovada", "em_curso", "concluida"].includes(k) ? " (quem aprova)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Checkbox
                  id="adiantar_13o"
                  checked={form.adiantar_13o}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, adiantar_13o: !!v }))}
                />
                <Label htmlFor="adiantar_13o" className="cursor-pointer">
                  Adiantar 13º
                </Label>
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

      <Tabs defaultValue="controle" className="space-y-3">
        <TabsList>
          <TabsTrigger value="controle">Controle CLT</TabsTrigger>
          <TabsTrigger value="programacoes">Programações</TabsTrigger>
        </TabsList>

        <TabsContent value="controle" className="space-y-3">
          <ControleFeriasPanel
            onProgramar={(f, periodo) => {
              setForm(() => ({
                ...formVazio(),
                funcionario_id: f.funcionario_id,
                periodo_aquisitivo_inicio: periodo.inicio,
                periodo_aquisitivo_fim: periodo.fim,
              }));
              setOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="programacoes">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Aquisitivo</TableHead>
                      <TableHead>Gozo</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Abono</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[1%] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(q.data ?? []).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.funcionario_nome}</TableCell>
                        <TableCell className="text-xs">
                          {formatData(f.periodo_aquisitivo_inicio)} →{" "}
                          {formatData(f.periodo_aquisitivo_fim)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {f.data_inicio
                            ? `${formatData(f.data_inicio)} → ${
                                f.data_fim ? formatData(f.data_fim) : "—"
                              }`
                            : "—"}
                        </TableCell>
                        <TableCell>{f.dias_gozados}</TableCell>
                        <TableCell>{f.abono_dias}</TableCell>
                        <TableCell>
                          <Badge className={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {f.status !== "concluida" && f.status !== "cancelada" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Editar férias de ${f.funcionario_nome}`}
                                onClick={() => {
                                  setForm({
                                    id: f.id,
                                    funcionario_id: f.funcionario_id,
                                    periodo_aquisitivo_inicio: f.periodo_aquisitivo_inicio,
                                    periodo_aquisitivo_fim: f.periodo_aquisitivo_fim,
                                    data_inicio: f.data_inicio ?? "",
                                    data_fim: f.data_fim ?? "",
                                    dias_gozados: f.dias_gozados,
                                    abono_dias: f.abono_dias,
                                    adiantar_13o: f.adiantar_13o,
                                    status: f.status,
                                    observacoes: f.observacoes ?? "",
                                  });
                                  setOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmDelete
                                titulo="Cancelar estas férias?"
                                descricao={`A programação de ${f.funcionario_nome} fica registrada como cancelada.`}
                                confirmarLabel="Cancelar férias"
                                onConfirm={() => cancelarFerias(f)}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Cancelar férias de ${f.funcionario_nome}`}
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!q.data || q.data.length === 0) && (
                      <LinhaEstadoLista
                        colSpan={7}
                        q={q}
                        vazio="Nenhum período de férias cadastrado."
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
