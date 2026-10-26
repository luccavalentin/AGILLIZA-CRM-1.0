import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Power, Save } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  criarCargo,
  criarDepartamento,
  desativarCargoOuDepartamento,
  editarCargo,
  editarDepartamento,
  listarCargos,
  listarDepartamentos,
} from "@/lib/rh/cargos-departamentos.functions";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  listarBeneficiosTipos,
  salvarBeneficioTipo,
  type RhBeneficioTipo,
} from "@/lib/rh/submodulos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { EstadoLista } from "@/components/rh/estado-lista";
import { BeneficiosVinculos } from "@/components/rh/beneficios-vinculos";
import { TabelasFiscaisPanel } from "@/components/rh/tabelas-fiscais-panel";

const ABAS_CFG = ["cargos", "departamentos", "beneficios", "tabelas", "regras"] as const;
type AbaCfg = (typeof ABAS_CFG)[number];

export const Route = createFileRoute("/_authenticated/rh/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.configuracoes"),
  validateSearch: (s: Record<string, unknown>): { aba?: AbaCfg } =>
    ABAS_CFG.includes(s.aba as AbaCfg) ? { aba: s.aba as AbaCfg } : {},
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: "/rh/configuracoes" });
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Configurações do RH</h1>
        <p className="text-xs text-muted-foreground">
          Cargos, departamentos, benefícios, tabelas da folha (INSS/IRRF por vigência) e as regras CLT aplicadas.
        </p>
      </div>

      <Tabs value={aba ?? "cargos"} onValueChange={(v) => navigate({ search: { aba: v as AbaCfg }, replace: true })}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
          <TabsTrigger value="tabelas">Tabelas da folha</TabsTrigger>
          <TabsTrigger value="regras">Regras CLT</TabsTrigger>
        </TabsList>

        <TabsContent value="cargos" className="mt-4">
          <CargosTab />
        </TabsContent>
        <TabsContent value="departamentos" className="mt-4">
          <DepartamentosTab />
        </TabsContent>
        <TabsContent value="beneficios" className="mt-4 space-y-4">
          <BeneficiosTab />
          <BeneficiosVinculos />
        </TabsContent>
        <TabsContent value="tabelas" className="mt-4">
          <TabelasFiscaisPanel />
        </TabsContent>
        <TabsContent value="regras" className="mt-4">
          <RegrasCltTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Cargos e departamentos: a mesma tela para os dois. O diálogo serve para criar
 * e para editar; "Desativar" tira da lista de escolha sem apagar o histórico.
 */
function CadastroSimplesRh({ tipo }: { tipo: "cargo" | "departamento" }) {
  const ehCargo = tipo === "cargo";
  const chave = ehCargo ? ["rh-cargos"] : ["rh-departamentos"];
  const qc = useQueryClient();
  const listarCargosFn = useServerFn(listarCargos);
  const listarDeptosFn = useServerFn(listarDepartamentos);
  const criarCargoFn = useServerFn(criarCargo);
  const criarDeptoFn = useServerFn(criarDepartamento);
  const editarCargoFn = useServerFn(editarCargo);
  const editarDeptoFn = useServerFn(editarDepartamento);
  const desativarFn = useServerFn(desativarCargoOuDepartamento);
  const lista = useQuery({
    queryKey: chave,
    queryFn: async (): Promise<
      Array<{ id: string; nome: string; cbo?: string | null; ativo: boolean }>
    > => (ehCargo ? listarCargosFn() : listarDeptosFn()),
  });
  const { data, isLoading } = lista;
  const [open, setOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cbo, setCbo] = useState("");
  const rotulo = ehCargo ? "cargo" : "departamento";
  const Rotulo = ehCargo ? "Cargo" : "Departamento";

  function abrir(item?: { id: string; nome: string; cbo?: string | null }) {
    setEditandoId(item?.id ?? null);
    setNome(item?.nome ?? "");
    setCbo(item?.cbo ?? "");
    setOpen(true);
  }

  const mut = useMutation({
    mutationFn: async () => {
      const n = nome.trim();
      if (editandoId) {
        return ehCargo
          ? editarCargoFn({ data: { id: editandoId, nome: n, cbo: cbo.trim() || null } })
          : editarDeptoFn({ data: { id: editandoId, nome: n } });
      }
      return ehCargo
        ? criarCargoFn({ data: { nome: n, cbo: cbo.trim() || null } })
        : criarDeptoFn({ data: { nome: n, responsavel_id: null } });
    },
    onSuccess: () => {
      toast.success(editandoId ? `${Rotulo} atualizado.` : `${Rotulo} criado.`);
      qc.invalidateQueries({ queryKey: chave });
      setOpen(false);
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  // Sem try/catch: o ConfirmDelete mostra o erro e continua aberto.
  async function desativar(id: string) {
    await desativarFn({ data: { id, tipo } });
    toast.success(`${Rotulo} desativado.`);
    qc.invalidateQueries({ queryKey: chave });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{ehCargo ? "Cargos" : "Departamentos"}</CardTitle>
        <Button size="sm" onClick={() => abrir()}>
          <Plus className="mr-1 h-4 w-4" /> Novo {rotulo}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editandoId ? `Editar ${rotulo}` : `Novo ${rotulo}`}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`rh-${tipo}-nome`}>Nome</Label>
                <Input
                  id={`rh-${tipo}-nome`}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              {ehCargo && (
                <div className="space-y-1.5">
                  <Label htmlFor="rh-cargo-cbo">CBO (opcional)</Label>
                  <Input id="rh-cargo-cbo" value={cbo} onChange={(e) => setCbo(e.target.value)} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={!nome.trim() || mut.isPending}>
                {mut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : lista.isError ? (
          <EstadoLista q={lista} vazio="" className="p-6" />
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum {rotulo} cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  {ehCargo && <TableHead>CBO</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    {ehCargo && <TableCell>{c.cbo ?? "—"}</TableCell>}
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${c.nome}`}
                        onClick={() => abrir(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDelete
                        titulo={`Desativar "${c.nome}"?`}
                        descricao={`O ${rotulo} sai das listas de escolha. Funcionários e históricos que já o usam continuam como estão.`}
                        confirmarLabel="Desativar"
                        onConfirm={() => desativar(c.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Desativar ${c.nome}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CargosTab() {
  return <CadastroSimplesRh tipo="cargo" />;
}

function DepartamentosTab() {
  return <CadastroSimplesRh tipo="departamento" />;
}

type BeneficioForm = {
  id?: string;
  nome: string;
  descricao: string;
  valor_padrao: number;
  desconto_padrao: number;
  natureza: string;
  ativo: boolean;
};

const NATUREZAS = [
  { value: "beneficio", label: "Benefício (provento)" },
  { value: "desconto", label: "Desconto" },
  { value: "misto", label: "Misto" },
];

function BeneficiosTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listarBeneficiosTipos);
  const salvar = useServerFn(salvarBeneficioTipo);
  const lista = useQuery({
    queryKey: ["rh-beneficios-tipos"],
    queryFn: () => fn(),
  });
  const { data, isLoading } = lista;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BeneficioForm>({
    nome: "",
    descricao: "",
    valor_padrao: 0,
    desconto_padrao: 0,
    natureza: "beneficio",
    ativo: true,
  });

  const editar = (b: RhBeneficioTipo) => {
    setForm({
      id: b.id,
      nome: b.nome,
      descricao: b.descricao ?? "",
      valor_padrao: Number(b.valor_padrao ?? 0),
      desconto_padrao: Number(b.desconto_padrao ?? 0),
      natureza: b.natureza ?? "beneficio",
      ativo: b.ativo,
    });
    setOpen(true);
  };

  const novo = () => {
    setForm({
      nome: "",
      descricao: "",
      valor_padrao: 0,
      desconto_padrao: 0,
      natureza: "beneficio",
      ativo: true,
    });
    setOpen(true);
  };

  const mut = useMutation({
    mutationFn: async () =>
      salvar({
        data: {
          id: form.id,
          nome: form.nome,
          descricao: form.descricao || null,
          valor_padrao: form.valor_padrao,
          desconto_padrao: form.desconto_padrao,
          natureza: form.natureza,
          ativo: form.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Tipo de benefício salvo.");
      qc.invalidateQueries({ queryKey: ["rh-beneficios-tipos"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao salvar.")),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Catálogo de benefícios</CardTitle>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo tipo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : lista.isError ? (
          <EstadoLista q={lista} vazio="" className="p-6" />
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum tipo cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Valor padrão</TableHead>
                  <TableHead className="text-right">Desconto padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => editar(b)}
                  >
                    <TableCell className="font-medium">{b.nome}</TableCell>
                    <TableCell className="capitalize">{b.natureza}</TableCell>
                    <TableCell className="text-right">
                      {Number(b.valor_padrao ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(b.desconto_padrao ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.ativo ? "default" : "secondary"}>
                        {b.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      Editar
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar tipo" : "Novo tipo de benefício"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Natureza</Label>
              <Select
                value={form.natureza}
                onValueChange={(v) => setForm((f) => ({ ...f, natureza: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATUREZAS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.ativo ? "true" : "false"}
                onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === "true" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_padrao || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valor_padrao: Number(e.target.value || 0) }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Desconto padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.desconto_padrao || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, desconto_padrao: Number(e.target.value || 0) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => mut.mutate()} disabled={!form.nome.trim() || mut.isPending}>
              {mut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RegrasCltTab() {
  const regras: { titulo: string; itens: string[] }[] = [
    {
      titulo: "Férias",
      itens: [
        "Os períodos aquisitivos são gerados automaticamente a cada 12 meses contados da data de admissão registrada na ficha do funcionário.",
        "O prazo para conceder as férias termina 12 meses após o fim do período aquisitivo; após esse prazo o período é sinalizado como vencido.",
        "Os dias de direito seguem as faltas injustificadas do período: até 5 faltas, 30 dias; de 6 a 14, 24 dias; de 15 a 23, 18 dias; de 24 a 32, 12 dias; acima disso, sem direito.",
        "O abono pecuniário é limitado a 1/3 do período (até 10 dias).",
        "A provisão exibida nos painéis considera o saldo adquirido, o período proporcional em formação e o terço constitucional.",
        "Alertas de vencimento são disparados quando faltam 90 dias ou menos para o limite de concessão.",
      ],
    },
    {
      titulo: "Folha e holerite",
      itens: [
        "INSS progressivo, IRRF (desconto simplificado, dependentes, pensão e a redução da Lei 15.270/2025), salário mínimo, salário-família e FGTS pela vigência cadastrada em Tabelas da folha — nada fixo no sistema.",
        "FGTS é depósito do empregador e não é descontado do colaborador.",
        "Horas extras, atrasos, adicional noturno, comissões e descontos entram como lançamentos da competência; o valor-hora vem da jornada da ficha (44 h semanais = 220 h no mês).",
        "Competência fechada fica travada no banco: lançamentos, faltas, atestados e adiantamentos do mês só mudam depois de reabrir (com motivo).",
        "Vale-transporte limitado a 6% do salário base.",
        "Horas extras a 50% em dias úteis e 100% em domingos e feriados; adicional noturno de 20%.",
        "Faltas injustificadas geram desconto do dia e do descanso semanal remunerado correspondente.",
      ],
    },
    {
      titulo: "Admissão e contrato",
      itens: [
        "A data de admissão é obrigatória no cadastro e passa a valer como marco de todos os cálculos de tempo de serviço.",
        "O contrato de experiência é acompanhado pelo campo de fim de experiência, com mudança automática de status ao término.",
        "O checklist documental CLT é criado automaticamente para cada novo funcionário.",
      ],
    },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {regras.map((g) => (
        <Card key={g.titulo}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{g.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {g.itens.map((t) => (
                <li key={t} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
