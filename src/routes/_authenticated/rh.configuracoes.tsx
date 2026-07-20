import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Save } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  criarCargo,
  criarDepartamento,
  listarCargos,
  listarDepartamentos,
} from "@/lib/rh/cargos-departamentos.functions";
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

export const Route = createFileRoute("/_authenticated/rh/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.configuracoes"),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">
          Configurações do RH
        </h1>
        <p className="text-xs text-muted-foreground">
          Cargos, departamentos e catálogo de benefícios.
        </p>
      </div>

      <Tabs defaultValue="cargos">
        <TabsList>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="beneficios">Tipos de benefícios</TabsTrigger>
        </TabsList>

        <TabsContent value="cargos" className="mt-4">
          <CargosTab />
        </TabsContent>
        <TabsContent value="departamentos" className="mt-4">
          <DepartamentosTab />
        </TabsContent>
        <TabsContent value="beneficios" className="mt-4">
          <BeneficiosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CargosTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listarCargos);
  const criar = useServerFn(criarCargo);
  const { data, isLoading } = useQuery({ queryKey: ["rh-cargos"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cbo, setCbo] = useState("");

  const mut = useMutation({
    mutationFn: async () => criar({ data: { nome, cbo: cbo || null } }),
    onSuccess: () => {
      toast.success("Cargo criado.");
      qc.invalidateQueries({ queryKey: ["rh-cargos"] });
      setOpen(false);
      setNome("");
      setCbo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cargos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo cargo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo cargo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CBO (opcional)</Label>
                <Input value={cbo} onChange={(e) => setCbo(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => mut.mutate()}
                disabled={!nome.trim() || mut.isPending}
              >
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
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum cargo cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CBO</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.cbo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
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

function DepartamentosTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listarDepartamentos);
  const criar = useServerFn(criarDepartamento);
  const { data, isLoading } = useQuery({
    queryKey: ["rh-departamentos"],
    queryFn: () => fn(),
  });
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const mut = useMutation({
    mutationFn: async () => criar({ data: { nome, responsavel_id: null } }),
    onSuccess: () => {
      toast.success("Departamento criado.");
      qc.invalidateQueries({ queryKey: ["rh-departamentos"] });
      setOpen(false);
      setNome("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Departamentos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo departamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo departamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <DialogFooter>
              <Button
                onClick={() => mut.mutate()}
                disabled={!nome.trim() || mut.isPending}
              >
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
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum departamento cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell>
                      <Badge variant={d.ativo ? "default" : "secondary"}>
                        {d.ativo ? "Ativo" : "Inativo"}
                      </Badge>
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
  const { data, isLoading } = useQuery({
    queryKey: ["rh-beneficios-tipos"],
    queryFn: () => fn(),
  });

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
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
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
                value={form.valor_padrao}
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
                value={form.desconto_padrao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, desconto_padrao: Number(e.target.value || 0) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => mut.mutate()}
              disabled={!form.nome.trim() || mut.isPending}
            >
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
