/**
 * Benefícios atribuídos (VT, VR, plano…): valor da empresa, desconto do colaborador e
 * vigência. Na ficha, fica preso ao funcionário; em Configurações, mostra a empresa toda.
 * Encerrar em vez de apagar: as folhas passadas ainda leem o benefício.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Gift, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import {
  listarBeneficiosDoFuncionario,
  listarBeneficiosTipos,
  vincularBeneficio,
  type RhFuncionarioBeneficio,
} from "@/lib/rh/submodulos.functions";
import { formatBRL, formatData, hojeISO } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";

export function BeneficiosVinculos({ funcionarioId }: { funcionarioId?: string }) {
  const qc = useQueryClient();
  const podeEditar = usePermissao("rh.beneficios", "edit");
  const fnTipos = useServerFn(listarBeneficiosTipos);
  const fnVincs = useServerFn(listarBeneficiosDoFuncionario);
  const fnVincular = useServerFn(vincularBeneficio);

  const tipos = useQuery({ queryKey: ["rh-ben-tipos"], queryFn: () => fnTipos() });
  const vincs = useQuery({
    queryKey: ["rh-ben-vinculos", funcionarioId ?? null],
    queryFn: () => fnVincs({ data: funcionarioId ? { funcionario_id: funcionarioId } : {} }),
  });

  const vazio = () => ({
    id: undefined as string | undefined,
    funcionario_id: funcionarioId ?? "",
    tipo_id: "",
    valor: 0,
    desconto: 0,
    vigencia_inicio: hojeISO(),
    vigencia_fim: "",
    ativo: true,
    observacoes: "",
  });
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState(vazio);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["rh-ben-vinculos"] });
    qc.invalidateQueries({ queryKey: ["rh-previa-folha"] });
  };
  const salvar = useMutation({
    mutationFn: () =>
      fnVincular({ data: { ...v, vigencia_fim: v.vigencia_fim || null, observacoes: v.observacoes.trim() || null } }),
    onSuccess: () => {
      toast.success(v.id ? "Benefício atualizado." : "Benefício atribuído.");
      invalidar();
      setAberto(false);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o benefício.")),
  });

  async function encerrar(b: RhFuncionarioBeneficio) {
    await fnVincular({
      data: {
        id: b.id,
        funcionario_id: b.funcionario_id,
        tipo_id: b.tipo_id,
        valor: b.valor,
        desconto: b.desconto,
        vigencia_inicio: b.vigencia_inicio,
        vigencia_fim: b.vigencia_fim && b.vigencia_fim < hojeISO() ? b.vigencia_fim : hojeISO(),
        ativo: false,
        observacoes: b.observacoes ?? null,
      },
    });
    toast.success("Benefício encerrado.");
    invalidar();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-primary" /> Benefícios atribuídos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            O desconto do colaborador entra na folha (VT limitado a 6% do salário).
          </p>
        </div>
        {podeEditar && (
          <Button
            size="sm"
            onClick={() => {
              setV(vazio());
              setAberto(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Atribuir
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!funcionarioId && <TableHead>Funcionário</TableHead>}
                <TableHead>Benefício</TableHead>
                <TableHead className="text-right">Empresa</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="hidden sm:table-cell">Vigência</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vincs.data ?? []).map((b) => (
                <TableRow key={b.id} className={b.ativo ? "" : "opacity-60"}>
                  {!funcionarioId && <TableCell className="font-medium">{b.funcionario_nome}</TableCell>}
                  <TableCell>{b.tipo_nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(b.valor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(b.desconto)}</TableCell>
                  <TableCell className="hidden text-xs sm:table-cell">
                    {formatData(b.vigencia_inicio)}
                    {b.vigencia_fim ? ` → ${formatData(b.vigencia_fim)}` : ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {podeEditar && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${b.tipo_nome}`}
                          onClick={() => {
                            setV({
                              id: b.id,
                              funcionario_id: b.funcionario_id,
                              tipo_id: b.tipo_id,
                              valor: b.valor,
                              desconto: b.desconto,
                              vigencia_inicio: b.vigencia_inicio,
                              vigencia_fim: b.vigencia_fim ?? "",
                              ativo: b.ativo,
                              observacoes: b.observacoes ?? "",
                            });
                            setAberto(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {b.ativo && (
                          <ConfirmDelete
                            titulo={`Encerrar ${b.tipo_nome}?`}
                            descricao="O benefício para de valer hoje. As folhas já fechadas não mudam."
                            confirmarLabel="Encerrar"
                            onConfirm={() => encerrar(b)}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Encerrar ${b.tipo_nome}`} className="text-destructive">
                                <Ban className="h-4 w-4" />
                              </Button>
                            }
                          />
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!vincs.data || vincs.data.length === 0) && (
                <LinhaEstadoLista colSpan={funcionarioId ? 5 : 6} q={vincs} vazio="Nenhum benefício atribuído." />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{v.id ? "Editar benefício" : "Atribuir benefício"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {!funcionarioId && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Funcionário</Label>
                <FuncionarioPicker value={v.funcionario_id} onChange={(x) => setV((p) => ({ ...p, funcionario_id: x ?? "" }))} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Benefício</Label>
              <Select
                value={v.tipo_id}
                onValueChange={(id) => {
                  const t = tipos.data?.find((x) => x.id === id);
                  setV((p) => ({ ...p, tipo_id: id, valor: t?.valor_padrao ?? 0, desconto: t?.desconto_padrao ?? 0 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (cadastre os tipos em Configurações)" />
                </SelectTrigger>
                <SelectContent>
                  {(tipos.data ?? [])
                    .filter((t) => t.ativo)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (empresa)</Label>
              <Input type="number" step="0.01" min={0} value={v.valor || ""} onChange={(e) => setV((p) => ({ ...p, valor: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Desconto (colaborador)</Label>
              <Input type="number" step="0.01" min={0} value={v.desconto || ""} onChange={(e) => setV((p) => ({ ...p, desconto: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={v.vigencia_inicio} onChange={(e) => setV((p) => ({ ...p, vigencia_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (opcional)</Label>
              <Input type="date" value={v.vigencia_fim} onChange={(e) => setV((p) => ({ ...p, vigencia_fim: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={v.observacoes} onChange={(e) => setV((p) => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !v.funcionario_id || !v.tipo_id}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
