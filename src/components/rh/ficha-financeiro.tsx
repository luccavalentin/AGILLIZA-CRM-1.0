/**
 * Abas financeiras individuais da ficha do funcionário:
 * adiantamentos (espelhados em contas a pagar), descontos e
 * alterações salariais — tudo lançado direto no cadastro.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listarAdiantamentos,
  listarDescontos,
  registrarAdiantamento,
  registrarDesconto,
  listarAlteracoesSalariais,
  registrarAlteracaoSalarial,
  type LancamentoStatus,
} from "@/lib/rh/submodulos.functions";
import { formatBRL } from "@/lib/financeiro/format";

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={99} className="py-8 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function Bloco({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {acao}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Adiantamentos e descontos compartilham a mesma estrutura de lançamento. */
function LancamentosTab({
  funcionarioId,
  tipo,
}: {
  funcionarioId: string;
  tipo: "adiantamento" | "desconto";
}) {
  const qc = useQueryClient();
  const hoje = new Date();
  const listar = useServerFn(tipo === "adiantamento" ? listarAdiantamentos : listarDescontos);
  const registrar = useServerFn(
    tipo === "adiantamento" ? registrarAdiantamento : registrarDesconto,
  );
  const chave = tipo === "adiantamento" ? "rh-ficha-adiant" : "rh-ficha-desc";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    data: hoje.toISOString().slice(0, 10),
    valor: "",
    competencia_mes: hoje.getMonth() + 1,
    competencia_ano: hoje.getFullYear(),
    descricao: "",
    status: "previsto" as LancamentoStatus,
  });

  const q = useQuery({
    queryKey: [chave, funcionarioId],
    queryFn: () => listar({ data: { funcionario_id: funcionarioId } }),
  });

  const salvar = useMutation({
    mutationFn: () => {
      const valor = Number(String(form.valor).replace(",", "."));
      if (!valor || valor <= 0) throw new Error("Informe um valor válido.");
      return registrar({
        data: {
          funcionario_id: funcionarioId,
          data: form.data,
          valor,
          competencia_mes: form.competencia_mes,
          competencia_ano: form.competencia_ano,
          descricao: form.descricao || null,
          status: form.status,
        },
      });
    },
    onSuccess: () => {
      toast.success(
        tipo === "adiantamento"
          ? "Adiantamento lançado e enviado ao contas a pagar."
          : "Desconto lançado.",
      );
      setOpen(false);
      setForm((p) => ({ ...p, valor: "", descricao: "" }));
      qc.invalidateQueries({ queryKey: [chave, funcionarioId] });
      qc.invalidateQueries({ queryKey: ["financeiro-contas-pagar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao lançar."),
  });

  return (
    <Bloco
      titulo={tipo === "adiantamento" ? "Adiantamentos" : "Descontos"}
      acao={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-3.5 w-3.5" /> Lançar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {tipo === "adiantamento" ? "Novo adiantamento" : "Novo desconto"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mês competência</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.competencia_mes || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, competencia_mes: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ano competência</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  value={form.competencia_ano || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, competencia_ano: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v as LancamentoStatus }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previsto">Previsto</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="descontado">Descontado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Vazio>Carregando…</Vazio>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && <Vazio>Nenhum lançamento.</Vazio>}
          {q.data?.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{fmtDate(l.data)}</TableCell>
              <TableCell>
                {String(l.competencia_mes).padStart(2, "0")}/{l.competencia_ano}
              </TableCell>
              <TableCell className="max-w-[280px] truncate">{l.descricao ?? "—"}</TableCell>
              <TableCell className="capitalize">{l.status}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(l.valor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}

export function FichaAdiantamentos({ funcionarioId }: { funcionarioId: string }) {
  return (
    <div className="space-y-3">
      <LancamentosTab funcionarioId={funcionarioId} tipo="adiantamento" />
      <p className="px-1 text-xs text-muted-foreground">
        Cada adiantamento gera automaticamente uma conta a pagar no Financeiro.
      </p>
    </div>
  );
}

export function FichaDescontos({ funcionarioId }: { funcionarioId: string }) {
  return <LancamentosTab funcionarioId={funcionarioId} tipo="desconto" />;
}

export function FichaAlteracoesSalariais({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarAlteracoesSalariais);
  const registrar = useServerFn(registrarAlteracaoSalarial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    salario_novo: "",
    vigencia: new Date().toISOString().slice(0, 10),
    tipo: "",
    motivo: "",
  });

  const q = useQuery({
    queryKey: ["rh-ficha-salarios", funcionarioId],
    queryFn: () => listar({ data: { funcionario_id: funcionarioId } }),
  });

  const salvar = useMutation({
    mutationFn: () => {
      const valor = Number(String(form.salario_novo).replace(",", "."));
      if (!valor || valor <= 0) throw new Error("Informe o novo salário.");
      return registrar({
        data: {
          funcionario_id: funcionarioId,
          salario_novo: valor,
          vigencia: form.vigencia,
          tipo: form.tipo || null,
          motivo: form.motivo || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Alteração salarial registrada.");
      setOpen(false);
      setForm((p) => ({ ...p, salario_novo: "", motivo: "" }));
      qc.invalidateQueries({ queryKey: ["rh-ficha-salarios", funcionarioId] });
      qc.invalidateQueries({ queryKey: ["rh-funcionario", funcionarioId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao registrar."),
  });

  return (
    <Bloco
      titulo="Alterações salariais"
      acao={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-3.5 w-3.5" /> Registrar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova alteração salarial</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Novo salário (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.salario_novo}
                  onChange={(e) => setForm((p) => ({ ...p, salario_novo: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vigência</Label>
                <Input
                  type="date"
                  value={form.vigencia}
                  onChange={(e) => setForm((p) => ({ ...p, vigencia: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Input
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  placeholder="Promoção, mérito, dissídio…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Input
                  value={form.motivo}
                  onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vigência</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">Anterior</TableHead>
            <TableHead className="text-right">Novo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Vazio>Carregando…</Vazio>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Vazio>Nenhuma alteração registrada.</Vazio>
          )}
          {q.data?.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{fmtDate(a.vigencia)}</TableCell>
              <TableCell className="capitalize">{a.tipo ?? "—"}</TableCell>
              <TableCell className="max-w-[260px] truncate">{a.motivo ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatBRL(a.salario_anterior)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatBRL(a.salario_novo)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}
