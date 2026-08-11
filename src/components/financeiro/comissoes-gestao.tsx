import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calculator, Plus, Trash2, Pencil } from "lucide-react";
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
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  listarRegrasComissaoAdmin,
  salvarRegraComissao,
  excluirRegraComissao,
  listarBancosParaComissao,
  simularComissao,
  PRODUTOS_COMISSAO,
  type RegraComissao,
  type ComissaoTipo,
  type SimulacaoComissaoResultado,
} from "@/lib/admin/comissoes.functions";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function produtoLabel(v: string | null) {
  return PRODUTOS_COMISSAO.find((p) => p.v === v)?.l ?? v ?? "Todos";
}

interface RegraForm {
  id?: string;
  banco_codigo: string;
  banco_nome: string;
  produto: string;
  faixa_min: number;
  faixa_max: number | null;
  tipo: ComissaoTipo;
  valor: number;
  percentual_parceiro: number;
  percentual_interno: number;
  vigencia_inicio: string;
  vigencia_fim: string;
  ativo: boolean;
}

const REGRA_VAZIA: RegraForm = {
  banco_codigo: "",
  banco_nome: "",
  produto: "todos",
  faixa_min: 0,
  faixa_max: null,
  tipo: "percentual",
  valor: 0,
  percentual_parceiro: 0,
  percentual_interno: 100,
  vigencia_inicio: "",
  vigencia_fim: "",
  ativo: true,
};

const TODOS_BANCOS = "__todos__";

export function SecaoRegrasComissao() {
  const qc = useQueryClient();
  const listar = useServerFn(listarRegrasComissaoAdmin);
  const listarBancos = useServerFn(listarBancosParaComissao);
  const salvar = useServerFn(salvarRegraComissao);
  const excluir = useServerFn(excluirRegraComissao);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<RegraForm>(REGRA_VAZIA);

  const { data, isLoading } = useQuery({ queryKey: ["admin-comissoes"], queryFn: () => listar() });
  const { data: bancos } = useQuery({
    queryKey: ["admin-comissoes-bancos"],
    queryFn: () => listarBancos(),
  });

  const salvarM = useMutation({
    mutationFn: (f: RegraForm) =>
      salvar({
        data: {
          id: f.id,
          banco_codigo: f.banco_codigo || null,
          banco_nome: f.banco_nome || null,
          produto: f.produto,
          faixa_min: f.faixa_min,
          faixa_max: f.faixa_max,
          tipo: f.tipo,
          valor: f.valor,
          percentual_parceiro: f.percentual_parceiro,
          percentual_interno: f.percentual_interno,
          vigencia_inicio: f.vigencia_inicio || null,
          vigencia_fim: f.vigencia_fim || null,
          ativo: f.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Regra salva.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["admin-comissoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra removida.");
      qc.invalidateQueries({ queryKey: ["admin-comissoes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    setForm(REGRA_VAZIA);
    setAberto(true);
  }
  function editar(r: RegraComissao) {
    setForm({
      id: r.id,
      banco_codigo: r.banco_codigo ?? "",
      banco_nome: r.banco_nome ?? "",
      produto: r.produto ?? "todos",
      faixa_min: Number(r.faixa_min),
      faixa_max: r.faixa_max != null ? Number(r.faixa_max) : null,
      tipo: r.tipo,
      valor: Number(r.valor),
      percentual_parceiro: Number(r.percentual_parceiro),
      percentual_interno: Number(r.percentual_interno),
      vigencia_inicio: r.vigencia_inicio ?? "",
      vigencia_fim: r.vigencia_fim ?? "",
      ativo: r.ativo,
    });
    setAberto(true);
  }

  function selecionarBanco(codigo: string) {
    if (codigo === TODOS_BANCOS) {
      setForm((f) => ({ ...f, banco_codigo: "", banco_nome: "" }));
      return;
    }
    const b = bancos?.find((x) => x.codigo === codigo);
    setForm((f) => ({ ...f, banco_codigo: codigo, banco_nome: b?.nome ?? "" }));
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Regras de comissão</CardTitle>
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
            Nenhuma regra de comissão cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Faixa</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Parceiro / Interno</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        <BancoLogo nome={r.banco_nome} size="xs" />
                        {r.banco_nome ?? "Todos os bancos"}
                      </span>
                    </TableCell>
                    <TableCell>{produtoLabel(r.produto)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(Number(r.faixa_min))}
                      {r.faixa_max != null ? ` – ${brl(Number(r.faixa_max))}` : "+"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.tipo === "percentual" ? `${r.valor}%` : brl(Number(r.valor))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.percentual_parceiro}% / {r.percentual_interno}%
                    </TableCell>
                    <TableCell>{r.ativo ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editar(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDelete
                          titulo="Remover regra de comissão?"
                          descricao="Operações futuras deixarão de aplicar esta regra."
                          onConfirm={() => excluirM.mutateAsync(r.id).then(() => {})}
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
        <DialogContent className="w-[calc(100%-2rem)] p-4 sm:max-w-lg md:p-6">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Nova"} regra de comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Select value={form.banco_codigo || TODOS_BANCOS} onValueChange={selecionarBanco}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS_BANCOS}>Todos os bancos</SelectItem>
                    {(bancos ?? []).map((b) => (
                      <SelectItem key={b.codigo} value={b.codigo}>
                        <span className="flex items-center gap-2">
                          <BancoLogo nome={b.nome} size="xs" />
                          {b.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Select
                  value={form.produto}
                  onValueChange={(v) => setForm((f) => ({ ...f, produto: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUTOS_COMISSAO.map((p) => (
                      <SelectItem key={p.v} value={p.v}>
                        {p.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Faixa mínima (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="0"
                  value={form.faixa_min || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      faixa_min: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Faixa máxima (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Sem limite"
                  value={form.faixa_max ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      faixa_max: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Input value="Percentual (%)" readOnly disabled />
                <p className="text-xs text-muted-foreground">
                  Os repasses são sempre calculados em percentual.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="0"
                  value={form.valor || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      tipo: "percentual",
                      valor: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>% Parceiro</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={form.percentual_parceiro || ""}
                  onChange={(e) => {
                    const p = e.target.value === "" ? 0 : Number(e.target.value);
                    setForm((f) => ({
                      ...f,
                      percentual_parceiro: p,
                      percentual_interno: Math.max(0, 100 - p),
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>% Interno</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.percentual_interno || ""}
                  readOnly
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vigência início</Label>
                <Input
                  type="date"
                  value={form.vigencia_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, vigencia_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vigência fim</Label>
                <Input
                  type="date"
                  value={form.vigencia_fim}
                  onChange={(e) => setForm((f) => ({ ...f, vigencia_fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="regra-ativa">Regra ativa</Label>
              <Switch
                id="regra-ativa"
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

export function SimuladorComissao() {
  const listarBancos = useServerFn(listarBancosParaComissao);
  const simular = useServerFn(simularComissao);
  const [banco, setBanco] = useState(TODOS_BANCOS);
  const [produto, setProduto] = useState("todos");
  const [valor, setValor] = useState<number>(0);
  const [resultado, setResultado] = useState<SimulacaoComissaoResultado | null>(null);

  const { data: bancos } = useQuery({
    queryKey: ["admin-comissoes-bancos"],
    queryFn: () => listarBancos(),
  });

  const simularM = useMutation({
    mutationFn: () =>
      simular({
        data: {
          banco_codigo: banco === TODOS_BANCOS ? null : banco,
          produto,
          valor_operacao: valor,
        },
      }),
    onSuccess: (r) => setResultado(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao simular."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-muted-foreground" /> Simulador de comissão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={banco} onValueChange={setBanco}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_BANCOS}>Todos os bancos</SelectItem>
                {(bancos ?? []).map((b) => (
                  <SelectItem key={b.codigo} value={b.codigo}>
                    <span className="flex items-center gap-2">
                      <BancoLogo nome={b.nome} size="xs" />
                      {b.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS_COMISSAO.map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {p.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor da operação (R$)</Label>
            <Input
              type="number"
              min={0}
              step={1000}
              placeholder="Digite o valor"
              value={valor || ""}
              onChange={(e) => setValor(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={() => simularM.mutate()} disabled={simularM.isPending || valor <= 0}>
          <Calculator className="mr-1 h-4 w-4" /> Simular
        </Button>

        {resultado && (
          <div className="rounded-md border border-border p-4">
            <p className="mb-3 text-sm text-muted-foreground">{resultado.descricao}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Comissão bruta</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {brl(resultado.bruto)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parceiro</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {brl(resultado.parceiro)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interno</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {brl(resultado.interno)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
