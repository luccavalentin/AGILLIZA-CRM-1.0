/**
 * Folha mensal › Lançamentos: o que entra na competência além do salário e dos
 * benefícios (horas extras, atraso, noturno, comissão, bônus, descontos…) e os
 * adiantamentos (que geram a conta a pagar). Competência fechada: só leitura.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, HandCoins, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import { excluirLancamento, listarLancamentos, salvarLancamento } from "@/lib/rh/folha.functions";
import {
  excluirAdiantamento,
  listarAdiantamentos,
  registrarAdiantamento,
} from "@/lib/rh/submodulos.functions";
import {
  LANCAMENTO_EM_HORAS,
  LANCAMENTO_LABEL,
  LANCAMENTO_NATUREZA,
  type TipoLancamento,
} from "@/lib/rh/entrada-competencia";
import { formatBRL, formatData, hojeISO } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { parseMoeda } from "@/lib/rh/moeda";

const TIPOS = Object.keys(LANCAMENTO_LABEL) as TipoLancamento[];

export function LancamentosCompetencia({ mes, ano, fechada }: { mes: number; ano: number; fechada: boolean }) {
  const qc = useQueryClient();
  const podeLancar = usePermissao("rh.folha", "edit") && !fechada;
  const fnListar = useServerFn(listarLancamentos);
  const fnSalvar = useServerFn(salvarLancamento);
  const fnExcluir = useServerFn(excluirLancamento);
  const fnAdis = useServerFn(listarAdiantamentos);
  const fnSalvarAdi = useServerFn(registrarAdiantamento);
  const fnExcluirAdi = useServerFn(excluirAdiantamento);

  const lanc = useQuery({
    queryKey: ["rh-lancamentos", mes, ano],
    queryFn: () => fnListar({ data: { mes, ano } }),
  });
  const adis = useQuery({
    queryKey: ["rh-adiantamentos", mes, ano],
    queryFn: () => fnAdis({ data: { competencia_mes: mes, competencia_ano: ano } }),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["rh-lancamentos"] });
    qc.invalidateQueries({ queryKey: ["rh-adiantamentos"] });
    qc.invalidateQueries({ queryKey: ["rh-previa-folha"] });
  };

  // ---- Novo lançamento ----
  const [aberto, setAberto] = useState(false);
  const vazio = { funcionario_id: "", tipo: "hora_extra_50" as TipoLancamento, quantidade: "", valor: "", descricao: "" };
  const [form, setForm] = useState(vazio);
  const emHoras = LANCAMENTO_EM_HORAS.has(form.tipo);
  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.funcionario_id) throw new Error("Escolha o funcionário.");
      await fnSalvar({
        data: {
          mes,
          ano,
          funcionario_id: form.funcionario_id,
          tipo: form.tipo,
          quantidade: emHoras ? Number(form.quantidade.replace(",", ".")) || 0 : null,
          valor: emHoras ? 0 : parseMoeda(form.valor),
          descricao: form.descricao || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Lançamento incluído na competência.");
      setForm(vazio);
      setAberto(false);
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível lançar.")),
  });

  // ---- Novo adiantamento ----
  const [abertoAdi, setAbertoAdi] = useState(false);
  const [adi, setAdi] = useState({ funcionario_id: "", valor: "", data: hojeISO(), descricao: "" });
  const salvarAdi = useMutation({
    mutationFn: async () => {
      if (!adi.funcionario_id) throw new Error("Escolha o funcionário.");
      await fnSalvarAdi({
        data: {
          funcionario_id: adi.funcionario_id,
          valor: parseMoeda(adi.valor),
          data: adi.data,
          competencia_mes: mes,
          competencia_ano: ano,
          descricao: adi.descricao || null,
          status: "previsto",
        },
      });
    },
    onSuccess: () => {
      toast.success("Adiantamento registrado e enviado ao Contas a Pagar.");
      setAbertoAdi(false);
      setAdi({ funcionario_id: "", valor: "", data: hojeISO(), descricao: "" });
      invalidar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar.")),
  });

  const resumo = useMemo(() => {
    const l = lanc.data ?? [];
    const horas = l.filter((x) => x.tipo === "hora_extra_50" || x.tipo === "hora_extra_100").reduce((s, x) => s + (x.quantidade ?? 0), 0);
    const proventos = l.filter((x) => LANCAMENTO_NATUREZA[x.tipo] === "provento" && !LANCAMENTO_EM_HORAS.has(x.tipo)).reduce((s, x) => s + x.valor, 0);
    const descontos = l.filter((x) => LANCAMENTO_NATUREZA[x.tipo] === "desconto" && !LANCAMENTO_EM_HORAS.has(x.tipo)).reduce((s, x) => s + x.valor, 0);
    const adiantamentos = (adis.data ?? []).filter((a) => a.status !== "cancelado").reduce((s, a) => s + a.valor, 0);
    return { horas, proventos, descontos, adiantamentos };
  }, [lanc.data, adis.data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo icone={Clock} rotulo="Horas extras" valor={`${resumo.horas.toLocaleString("pt-BR")} h`} />
        <Resumo icone={Plus} rotulo="Proventos lançados" valor={formatBRL(resumo.proventos)} />
        <Resumo icone={HandCoins} rotulo="Descontos lançados" valor={formatBRL(resumo.descontos)} />
        <Resumo icone={Wallet} rotulo="Adiantamentos" valor={formatBRL(resumo.adiantamentos)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Lançamentos do mês</CardTitle>
            <p className="text-xs text-muted-foreground">
              Horas são convertidas pelo valor-hora da jornada da ficha; valores entram como estão.
            </p>
          </div>
          <Button size="sm" onClick={() => setAberto(true)} disabled={!podeLancar}>
            <Plus className="mr-1.5 h-4 w-4" /> Lançar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Lançamento</TableHead>
                  <TableHead className="text-right">Horas / valor</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lanc.data ?? []).map((l) => {
                  const desconto = LANCAMENTO_NATUREZA[l.tipo] === "desconto";
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.funcionario_nome}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={desconto ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}
                        >
                          {LANCAMENTO_LABEL[l.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {LANCAMENTO_EM_HORAS.has(l.tipo)
                          ? `${(l.quantidade ?? 0).toLocaleString("pt-BR")} h`
                          : `${desconto ? "−" : "+"}${formatBRL(l.valor)}`}
                      </TableCell>
                      <TableCell className="hidden max-w-[280px] truncate text-xs text-muted-foreground md:table-cell">
                        {l.descricao ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {podeLancar && (
                          <ConfirmDelete
                            titulo="Excluir lançamento?"
                            descricao={`${LANCAMENTO_LABEL[l.tipo]} de ${l.funcionario_nome} sai da competência.`}
                            onConfirm={async () => {
                              await fnExcluir({ data: { id: l.id } });
                              invalidar();
                            }}
                            trigger={
                              <Button size="icon" variant="ghost" aria-label="Excluir lançamento">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!lanc.data || lanc.data.length === 0) && (
                  <LinhaEstadoLista
                    colSpan={5}
                    q={lanc}
                    vazio="Nenhum lançamento nesta competência. Horas extras, comissões e descontos entram aqui."
                  />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Adiantamentos</CardTitle>
            <p className="text-xs text-muted-foreground">
              Descontados no holerite e enviados ao Contas a Pagar no dia do pagamento.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAbertoAdi(true)} disabled={!podeLancar}>
            <Plus className="mr-1.5 h-4 w-4" /> Adiantamento
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden sm:table-cell">Situação</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(adis.data ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.funcionario_nome}</TableCell>
                    <TableCell>{formatData(a.data)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(a.valor)}</TableCell>
                    <TableCell className="hidden capitalize sm:table-cell">{a.status}</TableCell>
                    <TableCell className="text-right">
                      {podeLancar && (
                        <ConfirmDelete
                          titulo="Excluir adiantamento?"
                          descricao="A conta a pagar ainda em aberto também sai."
                          onConfirm={async () => {
                            await fnExcluirAdi({ data: { id: a.id } });
                            invalidar();
                          }}
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="Excluir adiantamento">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!adis.data || adis.data.length === 0) && (
                  <LinhaEstadoLista colSpan={5} q={adis} vazio="Nenhum adiantamento nesta competência." />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Funcionário</Label>
              <FuncionarioPicker value={form.funcionario_id} onChange={(v) => setForm((p) => ({ ...p, funcionario_id: v ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as TipoLancamento }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LANCAMENTO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {emHoras ? (
              <div className="space-y-1.5">
                <Label>Horas</Label>
                <Input
                  inputMode="decimal"
                  placeholder="Ex.: 8,5"
                  value={form.quantidade}
                  onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição (opcional)</Label>
              <Input
                maxLength={300}
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={abertoAdi} onOpenChange={setAbertoAdi}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo adiantamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Funcionário</Label>
              <FuncionarioPicker value={adi.funcionario_id} onChange={(v) => setAdi((p) => ({ ...p, funcionario_id: v ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={adi.valor} onChange={(e) => setAdi((p) => ({ ...p, valor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input type="date" value={adi.data} onChange={(e) => setAdi((p) => ({ ...p, data: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição (opcional)</Label>
              <Input value={adi.descricao} onChange={(e) => setAdi((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbertoAdi(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarAdi.mutate()} disabled={salvarAdi.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({ icone: Icone, rotulo, valor }: { icone: typeof Clock; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-foreground">{valor}</p>
      </div>
    </div>
  );
}
