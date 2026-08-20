import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, Plus } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FuncionarioPicker } from "@/components/rh/funcionario-picker";
import {
  listarBeneficiosDoFuncionario,
  listarBeneficiosTipos,
  salvarBeneficioTipo,
  vincularBeneficio,
} from "@/lib/rh/submodulos.functions";
import { formatBRL } from "@/lib/financeiro/format";

export const Route = createFileRoute("/_authenticated/rh/beneficios")({
  head: () => ({ meta: [{ title: "Benefícios — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.beneficios"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const fnTipos = useServerFn(listarBeneficiosTipos);
  const fnSalvarTipo = useServerFn(salvarBeneficioTipo);
  const fnVincs = useServerFn(listarBeneficiosDoFuncionario);
  const fnVincular = useServerFn(vincularBeneficio);

  const tipos = useQuery({ queryKey: ["rh-ben-tipos"], queryFn: () => fnTipos() });
  const vincs = useQuery({
    queryKey: ["rh-ben-vinculos"],
    queryFn: () => fnVincs(),
  });

  const [openTipo, setOpenTipo] = useState(false);
  const [tipo, setTipo] = useState({
    nome: "",
    descricao: "",
    valor_padrao: 0,
    desconto_padrao: 0,
    natureza: "beneficio",
    ativo: true,
  });

  const [openVinc, setOpenVinc] = useState(false);
  const [vinc, setVinc] = useState({
    funcionario_id: "",
    tipo_id: "",
    valor: 0,
    desconto: 0,
    vigencia_inicio: new Date().toISOString().slice(0, 10),
    vigencia_fim: "",
    ativo: true,
  });

  const criarTipo = useMutation({
    mutationFn: () => fnSalvarTipo({ data: tipo }),
    onSuccess: () => {
      toast.success("Tipo de benefício salvo.");
      qc.invalidateQueries({ queryKey: ["rh-ben-tipos"] });
      setOpenTipo(false);
      setTipo({
        nome: "",
        descricao: "",
        valor_padrao: 0,
        desconto_padrao: 0,
        natureza: "beneficio",
        ativo: true,
      });
    },
  });

  const criarVinc = useMutation({
    mutationFn: () =>
      fnVincular({
        data: {
          ...vinc,
          vigencia_fim: vinc.vigencia_fim || null,
        },
      }),
    onSuccess: () => {
      toast.success("Benefício atribuído.");
      qc.invalidateQueries({ queryKey: ["rh-ben-vinculos"] });
      setOpenVinc(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground md:text-2xl">
          <Gift className="h-5 w-5 text-primary" /> Benefícios
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure os tipos e vincule aos funcionários com valores e vigência.
        </p>
      </div>

      <Tabs defaultValue="vinculos">
        <TabsList>
          <TabsTrigger value="vinculos">Atribuídos</TabsTrigger>
          <TabsTrigger value="tipos">Tipos</TabsTrigger>
        </TabsList>

        <TabsContent value="vinculos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={openVinc} onOpenChange={setOpenVinc}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Atribuir benefício
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Atribuir benefício</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Funcionário</Label>
                    <FuncionarioPicker
                      value={vinc.funcionario_id}
                      onChange={(v) => setVinc((p) => ({ ...p, funcionario_id: v ?? "" }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Tipo</Label>
                    <Select
                      value={vinc.tipo_id}
                      onValueChange={(v) => {
                        const t = tipos.data?.find((x) => x.id === v);
                        setVinc((p) => ({
                          ...p,
                          tipo_id: v,
                          valor: t?.valor_padrao ?? 0,
                          desconto: t?.desconto_padrao ?? 0,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
                    <Input
                      type="number"
                      step="0.01"
                      value={vinc.valor || ""}
                      onChange={(e) => setVinc((p) => ({ ...p, valor: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desconto (funcionário)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={vinc.desconto || ""}
                      onChange={(e) => setVinc((p) => ({ ...p, desconto: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vigência início</Label>
                    <Input
                      type="date"
                      value={vinc.vigencia_inicio}
                      onChange={(e) => setVinc((p) => ({ ...p, vigencia_inicio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vigência fim</Label>
                    <Input
                      type="date"
                      value={vinc.vigencia_fim}
                      onChange={(e) => setVinc((p) => ({ ...p, vigencia_fim: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <Checkbox
                      id="ben-ativo"
                      checked={vinc.ativo}
                      onCheckedChange={(v) => setVinc((p) => ({ ...p, ativo: !!v }))}
                    />
                    <Label htmlFor="ben-ativo">Ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenVinc(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => criarVinc.mutate()}
                    disabled={criarVinc.isPending || !vinc.funcionario_id || !vinc.tipo_id}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Benefício</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead>Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vincs.data ?? []).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.funcionario_nome}</TableCell>
                        <TableCell>{v.tipo_nome}</TableCell>
                        <TableCell>{formatBRL(v.valor)}</TableCell>
                        <TableCell>{formatBRL(v.desconto)}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(v.vigencia_inicio).toLocaleDateString("pt-BR")}
                          {v.vigencia_fim
                            ? ` → ${new Date(v.vigencia_fim).toLocaleDateString("pt-BR")}`
                            : ""}
                        </TableCell>
                        <TableCell>{v.ativo ? "Sim" : "Não"}</TableCell>
                      </TableRow>
                    ))}
                    {(!vincs.data || vincs.data.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhum benefício atribuído.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tipos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={openTipo} onOpenChange={setOpenTipo}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Novo tipo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo tipo de benefício</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={tipo.nome}
                      onChange={(e) => setTipo((p) => ({ ...p, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Input
                      value={tipo.descricao}
                      onChange={(e) => setTipo((p) => ({ ...p, descricao: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Valor padrão</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tipo.valor_padrao || ""}
                        onChange={(e) =>
                          setTipo((p) => ({ ...p, valor_padrao: Number(e.target.value) }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Desconto padrão</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tipo.desconto_padrao || ""}
                        onChange={(e) =>
                          setTipo((p) => ({ ...p, desconto_padrao: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenTipo(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => criarTipo.mutate()}
                    disabled={!tipo.nome || criarTipo.isPending}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catálogo de tipos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor padrão</TableHead>
                      <TableHead>Desconto padrão</TableHead>
                      <TableHead>Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tipos.data ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.nome}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {t.descricao ?? "—"}
                        </TableCell>
                        <TableCell>{formatBRL(t.valor_padrao)}</TableCell>
                        <TableCell>{formatBRL(t.desconto_padrao)}</TableCell>
                        <TableCell>{t.ativo ? "Sim" : "Não"}</TableCell>
                      </TableRow>
                    ))}
                    {(!tipos.data || tipos.data.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhum tipo cadastrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
