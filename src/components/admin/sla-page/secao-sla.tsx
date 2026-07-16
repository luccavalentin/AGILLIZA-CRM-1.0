import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ListChecks, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  listarSlaConfiguracoes,
  salvarSlaConfiguracao,
  excluirSlaConfiguracao,
  type SlaConfig,
  type CatalogoItem,
} from "@/lib/admin/sla.functions";

export interface SlaForm {
  id?: string;
  tipo: string;
  prioridade: string;
  horas_uteis: number;
  canal_escalonamento: string;
  ativo: boolean;
}

function mapaLabel(itens: CatalogoItem[] | undefined) {
  const m = new Map<string, string>();
  (itens ?? []).forEach((i) => m.set(i.valor, i.label));
  return m;
}

export function SecaoSla({
  tipos,
  prioridades,
  canais,
}: {
  tipos?: CatalogoItem[];
  prioridades?: CatalogoItem[];
  canais?: CatalogoItem[];
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarSlaConfiguracoes);
  const salvar = useServerFn(salvarSlaConfiguracao);
  const excluir = useServerFn(excluirSlaConfiguracao);
  const [aberto, setAberto] = useState(false);

  const tipoMap = useMemo(() => mapaLabel(tipos), [tipos]);
  const prioMap = useMemo(() => mapaLabel(prioridades), [prioridades]);
  const canalMap = useMemo(() => mapaLabel(canais), [canais]);

  const vazio: SlaForm = {
    tipo: tipos?.[0]?.valor ?? "geral",
    prioridade: prioridades?.[1]?.valor ?? prioridades?.[0]?.valor ?? "p2",
    horas_uteis: 8,
    canal_escalonamento: canais?.[0]?.valor ?? "gestor",
    ativo: true,
  };
  const [form, setForm] = useState<SlaForm>(vazio);

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
    setForm(vazio);
    setAberto(true);
  }
  function editar(s: SlaConfig) {
    setForm({ ...s });
    setAberto(true);
  }

  const tiposAtivos = (tipos ?? []).filter((t) => t.ativo);
  const priosAtivas = (prioridades ?? []).filter((p) => p.ativo);
  const canaisAtivos = (canais ?? []).filter((c) => c.ativo);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-muted-foreground" /> Configurações de SLA
        </CardTitle>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Nova regra
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma regra de SLA. Sem regra, o padrão é P1=4h, P2=8h, P3=24h úteis.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                    <TableCell className="font-medium text-foreground">
                      {tipoMap.get(s.tipo) ?? s.tipo}
                    </TableCell>
                    <TableCell>{prioMap.get(s.prioridade) ?? s.prioridade}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.horas_uteis}h</TableCell>
                    <TableCell>
                      {canalMap.get(s.canal_escalonamento) ?? s.canal_escalonamento}
                    </TableCell>
                    <TableCell>{s.ativo ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editar(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDelete
                          titulo="Remover regra de SLA?"
                          descricao="Demandas passarão a usar o padrão do sistema."
                          onConfirm={() => excluirM.mutateAsync(s.id).then(() => {})}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                            >
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
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Nova"} regra de SLA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de demanda</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivos.map((t) => (
                      <SelectItem key={t.id} value={t.valor}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priosAtivas.map((p) => (
                      <SelectItem key={p.id} value={p.valor}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Horas úteis</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.horas_uteis}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, horas_uteis: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Escalonar para</Label>
                <Select
                  value={form.canal_escalonamento}
                  onValueChange={(v) => setForm((f) => ({ ...f, canal_escalonamento: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canaisAtivos.map((c) => (
                      <SelectItem key={c.id} value={c.valor}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="sla-ativo">Regra ativa</Label>
              <Switch
                id="sla-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarM.mutate(form)} disabled={salvarM.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
