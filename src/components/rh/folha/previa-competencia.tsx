/**
 * Folha mensal › Prévia e fechamento: o cálculo de cada funcionário pela tabela da
 * competência, com o holerite aberto em linhas; fechar grava tudo no banco (itens,
 * totais e contas a pagar) e trava a competência; reabrir exige motivo.
 */
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinhaEstadoLista } from "@/components/rh/estado-lista";
import { usePermissao } from "@/hooks/use-permissao";
import {
  fecharCompetencia,
  listarItensFolha,
  previaFolha,
  reabrirCompetencia,
  type FolhaItem,
} from "@/lib/rh/folha.functions";
import { formatBRL } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function PreviaCompetencia({ mes, ano, fechada }: { mes: number; ano: number; fechada: boolean }) {
  const qc = useQueryClient();
  const podeVerSalario = usePermissao("rh.salarios", "view");
  const podeGerir = usePermissao("rh.folha", "gerir");
  const fnPrevia = useServerFn(previaFolha);
  const fnFechar = useServerFn(fecharCompetencia);
  const fnReabrir = useServerFn(reabrirCompetencia);
  const [aberta, setAberta] = useState<string | null>(null);

  const fnItens = useServerFn(listarItensFolha);
  // Aberta: cálculo ao vivo. Fechada: o que foi gravado no fechamento (não muda mais).
  const previa = useQuery({
    queryKey: ["rh-previa-folha", mes, ano, fechada],
    enabled: podeVerSalario,
    queryFn: async (): Promise<FolhaItem[]> => {
      if (!fechada) return fnPrevia({ data: { mes, ano } });
      const r = await fnItens({ data: { mes, ano } });
      return r.itens.map((it) => {
        const d = it.detalhamento ?? {};
        return {
          funcionario_id: it.funcionario_id,
          funcionario_nome: it.funcionario_nome,
          funcionario_numero: it.funcionario_numero,
          cargo: it.cargo,
          salario_base: it.salario_base,
          proventos: Math.round((it.liquido + it.total_descontos) * 100) / 100,
          descontos: it.total_descontos,
          liquido: it.liquido,
          gera_conta_pagar: true,
          detalhes: {
            adiantamentos: Number(d.adiantamentos ?? 0),
            inss: Number(d.inss ?? 0),
            irrf: Number(d.irrf ?? 0),
            base_inss: Number(d.base_inss ?? 0),
            base_irrf: Number(d.base_irrf ?? 0),
            fgts: Number(d.fgts ?? 0),
            dependentes_ir: Number(d.dependentes_ir ?? 0),
            faltas_dias: Number(d.faltas_dias ?? 0),
            horas_extras: Number(d.horas_extras ?? 0),
            beneficios_desconto: Number(d.beneficios_desconto ?? 0),
            lancamentos: Number(d.lancamentos ?? 0),
          },
          linhas: d.linhas ?? { proventos: [], descontos: [] },
        };
      });
    },
  });

  const totais = useMemo(
    () =>
      (previa.data ?? []).reduce(
        (a, i) => ({
          proventos: a.proventos + i.proventos,
          descontos: a.descontos + i.descontos,
          liquido: a.liquido + i.liquido,
          fgts: a.fgts + i.detalhes.fgts,
          contas: a.contas + (i.gera_conta_pagar && i.liquido > 0 ? 1 : 0),
        }),
        { proventos: 0, descontos: 0, liquido: 0, fgts: 0, contas: 0 },
      ),
    [previa.data],
  );

  const [dlgFechar, setDlgFechar] = useState(false);
  const [venc, setVenc] = useState(() => {
    // 5º dia do mês seguinte à competência (limite da CLT é o 5º dia útil).
    const d = new Date(Date.UTC(ano, mes, 5));
    return d.toISOString().slice(0, 10);
  });
  const [obs, setObs] = useState("");
  const fechar = useMutation({
    mutationFn: () => fnFechar({ data: { mes, ano, vencimento: venc, observacoes: obs || null } }),
    onSuccess: (r) => {
      toast.success(`Competência fechada: ${r.itens} holerite(s) e ${r.contas} conta(s) a pagar.`);
      setDlgFechar(false);
      qc.invalidateQueries({ queryKey: ["rh-competencias"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      qc.invalidateQueries({ queryKey: ["rh-itens-folha"] });
      qc.invalidateQueries({ queryKey: ["rh-previa-folha"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível fechar a competência.")),
  });

  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const reabrir = useMutation({
    mutationFn: () => fnReabrir({ data: { mes, ano, motivo } }),
    onSuccess: (r) => {
      toast.success(`Competência reaberta. ${r.contas_removidas} conta(s) em aberto removida(s).`);
      setDlgReabrir(false);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["rh-competencias"] });
      qc.invalidateQueries({ queryKey: ["rh-itens-folha"] });
      qc.invalidateQueries({ queryKey: ["rh-previa-folha"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reabrir.")),
  });

  if (!podeVerSalario) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">A prévia mostra salários</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Para ver os valores por pessoa é preciso a permissão RH · Salários · ver. Os lançamentos do
            mês continuam disponíveis na aba Lançamentos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total rotulo="Proventos" valor={formatBRL(totais.proventos)} />
        <Total rotulo="Descontos" valor={formatBRL(totais.descontos)} />
        <Total rotulo="Líquido a pagar" valor={formatBRL(totais.liquido)} destaque />
        <Total rotulo="FGTS (empregador)" valor={formatBRL(totais.fgts)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">
              {fechada ? "Folha fechada" : "Prévia"} · {MESES[mes - 1]} de {ano}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Salário vigente, benefícios, faltas, lançamentos e adiantamentos pela tabela de INSS/IRRF da
              competência. Toque na linha para ver o holerite.
            </p>
          </div>
          {podeGerir &&
            (fechada ? (
              <Button variant="outline" size="sm" onClick={() => setDlgReabrir(true)}>
                <LockOpen className="mr-1.5 h-4 w-4" /> Reabrir
              </Button>
            ) : (
              <Button size="sm" onClick={() => setDlgFechar(true)} disabled={!previa.data || previa.data.length === 0}>
                <Lock className="mr-1.5 h-4 w-4" /> Fechar competência
              </Button>
            ))}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Salário</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Proventos</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previa.data ?? []).map((i) => (
                  <Fragment key={i.funcionario_id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setAberta((a) => (a === i.funcionario_id ? null : i.funcionario_id))}
                    >
                      <TableCell>
                        {aberta === i.funcionario_id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{i.funcionario_nome}</p>
                        <p className="text-xs text-muted-foreground">{i.cargo ?? "Sem cargo"}</p>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatBRL(i.salario_base)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatBRL(i.proventos)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums text-destructive sm:table-cell">
                        −{formatBRL(i.descontos)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatBRL(i.liquido)}</TableCell>
                    </TableRow>
                    {aberta === i.funcionario_id && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6}>
                          <div className="grid gap-4 py-2 md:grid-cols-2">
                            <Linhas titulo="Proventos" linhas={i.linhas.proventos} />
                            <Linhas titulo="Descontos" linhas={i.linhas.descontos} negativo />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Base INSS {formatBRL(i.detalhes.base_inss)} · Base IRRF {formatBRL(i.detalhes.base_irrf)} ·
                            FGTS {formatBRL(i.detalhes.fgts)} · {i.detalhes.dependentes_ir} dependente(s) IR ·{" "}
                            {fechada ? "valores gravados no fechamento" : i.gera_conta_pagar ? "gera conta a pagar" : "sem conta a pagar (marcado na ficha)"}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                {(!previa.data || previa.data.length === 0) && (
                  <LinhaEstadoLista
                    colSpan={6}
                    q={previa}
                    vazio="Ninguém na folha desta competência (admitidos até o fim do mês e não desligados antes dele)."
                    erro="Não foi possível calcular a prévia."
                  />
                )}
              </TableBody>
              {previa.data && previa.data.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      {previa.data.length} funcionário(s)
                    </TableCell>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatBRL(totais.proventos)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">−{formatBRL(totais.descontos)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatBRL(totais.liquido)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dlgFechar} onOpenChange={setDlgFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Fechar {MESES[mes - 1]} de {ano}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Grava a folha de {previa.data?.length ?? 0} funcionário(s) (líquido {formatBRL(totais.liquido)}) e cria{" "}
              {totais.contas} conta(s) a pagar. Depois de fechada, lançamentos, faltas e adiantamentos do mês
              ficam travados e os holerites podem ser publicados.
            </p>
            <div className="space-y-1.5">
              <Label>Vencimento das contas a pagar</Label>
              <Input type="date" className="sm:max-w-[220px]" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgFechar(false)}>
              Cancelar
            </Button>
            <Button onClick={() => fechar.mutate()} disabled={fechar.isPending}>
              <Lock className="mr-1.5 h-4 w-4" /> Fechar competência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgReabrir} onOpenChange={setDlgReabrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir {MESES[mes - 1]} de {ano}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Os itens da folha e as contas a pagar ainda em aberto saem; se algum salário já foi pago no
              Financeiro, a reabertura é recusada. O motivo fica registrado na competência.
            </p>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgReabrir(false)}>
              Cancelar
            </Button>
            <Button onClick={() => reabrir.mutate()} disabled={reabrir.isPending || motivo.trim().length < 5}>
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${destaque ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${destaque ? "text-primary" : "text-foreground"}`}>
        {valor}
      </p>
    </div>
  );
}

function Linhas({
  titulo,
  linhas,
  negativo,
}: {
  titulo: string;
  linhas: Array<{ codigo: string; descricao: string; referencia: string; valor: number }>;
  negativo?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {linhas.map((l) => (
            <li key={l.codigo + l.descricao} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="mr-1 text-[11px] text-muted-foreground">{l.codigo}</span>
                {l.descricao}
                <span className="ml-1 text-[11px] text-muted-foreground">{l.referencia !== "—" ? l.referencia : ""}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${negativo ? "text-destructive" : ""}`}>
                {negativo ? "−" : ""}
                {formatBRL(l.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
