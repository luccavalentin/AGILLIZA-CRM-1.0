import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Timer, CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSlaConfiguracoes, salvarSlaConfiguracao, excluirSlaConfiguracao,
  listarFeriados, criarFeriado, excluirFeriado,
  TIPOS_SLA, type SlaConfig, type Prioridade,
} from "@/lib/admin/sla.functions";

export const Route = createFileRoute("/_authenticated/admin/sla")({
  head: () => ({ meta: [{ title: "SLA & Feriados — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.sla"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>
  ),
});

const PRIO_LABEL: Record<Prioridade, string> = { p1: "P1 — Alta", p2: "P2 — Média", p3: "P3 — Baixa" };
const CANAIS = [
  { v: "gestor", l: "Gestor" },
  { v: "correspondente", l: "Correspondente" },
];

function tipoLabel(v: string) {
  return TIPOS_SLA.find((t) => t.v === v)?.l ?? v;
}

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">SLA & Feriados</h1>
          <p className="text-sm text-muted-foreground">
            Prazos por tipo de demanda e prioridade (horas úteis) e calendário de feriados.
          </p>
        </div>
      </div>
      <SecaoSla />
      <SecaoFeriados />
    </div>
  );
}

/* ----------------------------- SLA ----------------------------- */

interface SlaForm {
  id?: string;
  tipo: string;
  prioridade: Prioridade;
  horas_uteis: number;
  canal_escalonamento: string;
  ativo: boolean;
}

const SLA_VAZIO: SlaForm = {
  tipo: "geral", prioridade: "p2", horas_uteis: 8, canal_escalonamento: "gestor", ativo: true,
};

function SecaoSla() {
  const qc = useQueryClient();
  const listar = useServerFn(listarSlaConfiguracoes);
  const salvar = useServerFn(salvarSlaConfiguracao);
  const excluir = useServerFn(excluirSlaConfiguracao);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<SlaForm>(SLA_VAZIO);

  const { data, isLoading } = useQuery({ queryKey: ["admin-sla"], queryFn: () => listar() });

  const salvarM = useMutation({
    mutationFn: (f: SlaForm) => salvar({ data: f }),
    onSuccess: () => {
      toast.success("SLA salvo.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["admin-sla"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("SLA removido.");
      qc.invalidateQueries({ queryKey: ["admin-sla"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    setForm(SLA_VAZIO);
    setAberto(true);
  }
  function editar(s: SlaConfig) {
    setForm({ ...s });
    setAberto(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Configurações de SLA</CardTitle>
        <Button size="sm" onClick={novo}><Plus className="mr-1 h-4 w-4" /> Nova regra</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma regra de SLA. Sem regra, o padrão é P1=4h, P2=8h, P3=24h úteis.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Horas úteis</TableHead>
                <TableHead>Escalonar p/</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">{tipoLabel(s.tipo)}</TableCell>
                  <TableCell>{PRIO_LABEL[s.prioridade]}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.horas_uteis}h</TableCell>
                  <TableCell className="capitalize">{s.canal_escalonamento}</TableCell>
                  <TableCell>{s.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editar(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDelete
                        titulo="Remover regra de SLA?"
                        descricao="Demandas passarão a usar o padrão do sistema."
                        onConfirm={() => excluirM.mutateAsync(s.id).then(() => {})}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} regra de SLA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de demanda</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_SLA.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v as Prioridade }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p1">P1 — Alta</SelectItem>
                    <SelectItem value="p2">P2 — Média</SelectItem>
                    <SelectItem value="p3">P3 — Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Horas úteis</Label>
                <Input
                  type="number" min={1} step={1} value={form.horas_uteis}
                  onChange={(e) => setForm((f) => ({ ...f, horas_uteis: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Escalonar para</Label>
                <Select value={form.canal_escalonamento} onValueChange={(v) => setForm((f) => ({ ...f, canal_escalonamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="sla-ativo">Regra ativa</Label>
              <Switch id="sla-ativo" checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvarM.mutate(form)} disabled={salvarM.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* --------------------------- Feriados --------------------------- */

function SecaoFeriados() {
  const qc = useQueryClient();
  const listar = useServerFn(listarFeriados);
  const criar = useServerFn(criarFeriado);
  const excluir = useServerFn(excluirFeriado);
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: feriados, isLoading } = useQuery({ queryKey: ["admin-feriados"], queryFn: () => listar() });

  const criarM = useMutation({
    mutationFn: () => criar({ data: { data, descricao } }),
    onSuccess: () => {
      toast.success("Feriado cadastrado.");
      setData(""); setDescricao("");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Feriado removido.");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não é possível remover feriados globais."),
  });

  function adicionar() {
    if (!data) return toast.error("Informe a data.");
    if (descricao.trim().length < 2) return toast.error("Informe a descrição.");
    criarM.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Feriados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Feriado municipal" />
          </div>
          <Button onClick={adicionar} disabled={criarM.isPending}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (feriados?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feriados!.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="tabular-nums">
                    {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-foreground">{f.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{f.correspondente_id ? "Meu" : "Nacional"}</TableCell>
                  <TableCell className="text-right">
                    {f.correspondente_id ? (
                      <ConfirmDelete
                        titulo="Remover feriado?"
                        onConfirm={() => excluirM.mutateAsync(f.id).then(() => {})}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
