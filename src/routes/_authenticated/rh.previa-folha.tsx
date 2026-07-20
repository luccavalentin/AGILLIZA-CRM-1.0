import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, Lock, CheckCircle2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableFooter,
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
  fecharCompetencia,
  listarCompetencias,
  previaFolha,
  type StatusCompetencia,
} from "@/lib/rh/folha.functions";
import { formatBRL } from "@/lib/financeiro/format";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const STATUS_TONE: Record<StatusCompetencia, string> = {
  aberta: "bg-muted text-muted-foreground",
  conferida: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  fechada: "bg-primary/15 text-primary",
  cancelada: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/rh/previa-folha")({
  head: () => ({ meta: [{ title: "Prévia da folha — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.previa_folha"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnPrevia = useServerFn(previaFolha);
  const fnCompetencias = useServerFn(listarCompetencias);
  const fnFechar = useServerFn(fecharCompetencia);

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [openFechar, setOpenFechar] = useState(false);
  const [venc, setVenc] = useState(() => {
    const d = new Date();
    d.setDate(5);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [observacoes, setObservacoes] = useState("");

  const previa = useQuery({
    queryKey: ["rh-previa-folha", mes, ano],
    queryFn: () => fnPrevia({ data: { mes, ano } }),
  });

  const historico = useQuery({
    queryKey: ["rh-competencias"],
    queryFn: () => fnCompetencias(),
  });

  const fechar = useMutation({
    mutationFn: () =>
      fnFechar({ data: { mes, ano, vencimento: venc, observacoes: observacoes || null } }),
    onSuccess: (res) => {
      toast.success(`Competência fechada. ${res.contas} contas criadas no financeiro.`);
      qc.invalidateQueries({ queryKey: ["rh-competencias"] });
      qc.invalidateQueries({ queryKey: ["rh-kpis"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      setOpenFechar(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao fechar competência."),
  });

  const totais = (previa.data ?? []).reduce(
    (acc, i) => {
      acc.proventos += i.proventos;
      acc.descontos += i.descontos;
      acc.liquido += i.liquido;
      return acc;
    },
    { proventos: 0, descontos: 0, liquido: 0 },
  );

  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];
  const jaFechada = (historico.data ?? []).some(
    (c) => c.mes === mes && c.ano === ano && c.status === "fechada",
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
            <ClipboardList className="h-5 w-5 text-primary" /> Prévia da folha
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolida salários, benefícios e descontos por competência antes do fechamento.
          </p>
        </div>
        <Button
          onClick={() => setOpenFechar(true)}
          disabled={jaFechada || !previa.data || previa.data.length === 0}
        >
          {jaFechada ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Já fechada
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" /> Fechar competência
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
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
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Prévia · {MESES[mes - 1]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead className="text-right">Benefícios</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Adiantamentos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previa.data ?? []).map((i) => (
                  <TableRow key={i.funcionario_id}>
                    <TableCell className="font-medium">{i.funcionario_nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.cargo ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatBRL(i.salario_base)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatBRL(i.detalhes.beneficios_valor)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatBRL(i.detalhes.beneficios_desconto + i.detalhes.descontos_lancados)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatBRL(i.detalhes.adiantamentos)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(i.liquido)}</TableCell>
                  </TableRow>
                ))}
                {(!previa.data || previa.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum funcionário ativo nesta competência.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {previa.data && previa.data.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Totais</TableCell>
                    <TableCell colSpan={2} className="text-right">
                      Proventos: {formatBRL(totais.proventos)}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right">
                      Descontos: {formatBRL(totais.descontos)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatBRL(totais.liquido)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competências anteriores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Proventos</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead>Fechada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(historico.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{MESES[c.mes - 1]}/{c.ano}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(c.total_proventos)}</TableCell>
                    <TableCell className="text-right">{formatBRL(c.total_descontos)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(c.total_liquido)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.fechada_em ? new Date(c.fechada_em).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!historico.data || historico.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma competência fechada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Fechar competência {MESES[mes - 1]}/{ano}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O sistema criará uma conta a pagar por funcionário no módulo Financeiro, com o líquido
              e o vencimento informado abaixo. Total: <strong>{formatBRL(totais.liquido)}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>Vencimento das contas a pagar</Label>
              <Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenFechar(false)}>Cancelar</Button>
            <Button onClick={() => fechar.mutate()} disabled={fechar.isPending}>
              Fechar e gerar pagamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
