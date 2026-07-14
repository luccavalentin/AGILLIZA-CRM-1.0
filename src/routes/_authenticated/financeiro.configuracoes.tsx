import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  Tags,
  Building2,
  
  Percent,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarConfigsGestao,
  criarConfig,
  atualizarConfig,
  excluirConfig,
  type ConfigEntidade,
  type ConfigItem,
} from "@/lib/financeiro/financeiro.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  SecaoRegrasComissao,
  SimuladorComissao,
} from "@/components/financeiro/comissoes-gestao";

export const Route = createFileRoute("/_authenticated/financeiro/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações financeiras — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.painel"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-3 sm:p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Configurações financeiras
          </h1>
          <p className="text-sm text-muted-foreground">
            Centralize aqui os parâmetros do módulo financeiro: plano de contas, centros de
            custo e regras de comissão.
          </p>
        </div>
      </header>

      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="categorias" className="gap-1.5">
            <Tags className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="centros" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Centros de custo
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-1.5">
            <Percent className="h-4 w-4" /> Comissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <SecaoCategorias />
        </TabsContent>
        <TabsContent value="centros" className="mt-4">
          <SecaoSimples
            entidade="centro"
            titulo="Centros de custo"
            descricao="Agrupe lançamentos por unidade, equipe ou projeto para análises gerenciais."
            singular="centro de custo"
            icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          />
        </TabsContent>
        <TabsContent value="comissoes" className="mt-4 space-y-6">
          <SecaoRegrasComissao />
          <SimuladorComissao />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const QK = ["fin-configs-gestao"];

function useConfigs() {
  const listar = useServerFn(listarConfigsGestao);
  return useQuery({ queryKey: QK, queryFn: () => listar() });
}

/* --------------------------- Categorias --------------------------- */

function SecaoCategorias() {
  const qc = useQueryClient();
  const { data, isLoading } = useConfigs();
  const criar = useServerFn(criarConfig);
  const atualizar = useServerFn(atualizarConfig);
  const excluir = useServerFn(excluirConfig);

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const salvar = useMutation({
    mutationFn: async () => {
      if (editId) {
        return atualizar({ data: { entidade: "categoria", id: editId, nome, tipo } });
      }
      return criar({ data: { entidade: "categoria", nome, tipo } });
    },
    onSuccess: () => {
      toast.success(editId ? "Categoria atualizada." : "Categoria criada.");
      setAberto(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const alternar = useMutation({
    mutationFn: (i: ConfigItem) =>
      atualizar({ data: { entidade: "categoria", id: i.id, ativo: !i.ativo } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => excluir({ data: { entidade: "categoria", id } }),
    onSuccess: (r) => {
      toast.success(r.desativado ? "Categoria desativada (possui lançamentos)." : "Categoria removida.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    setEditId(null);
    setNome("");
    setTipo("despesa");
    setAberto(true);
  }
  function editar(i: ConfigItem) {
    setEditId(i.id);
    setNome(i.nome);
    setTipo((i.tipo as "despesa" | "receita") ?? "despesa");
    setAberto(true);
  }

  const cats = data?.categorias ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4 text-muted-foreground" /> Categorias
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Plano de contas de receitas e despesas usado na classificação dos lançamentos.
          </p>
        </div>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Nova categoria
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListaSkeleton />
        ) : cats.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma categoria cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-28 text-center">Ativa</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c.id} className={c.ativo ? "" : "opacity-60"}>
                    <TableCell className="font-medium text-foreground">{c.nome}</TableCell>
                    <TableCell>
                      {c.tipo === "receita" ? (
                        <Badge variant="outline" className="gap-1 text-emerald-600">
                          <TrendingUp className="h-3 w-3" /> Receita
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-destructive">
                          <TrendingDown className="h-3 w-3" /> Despesa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={() => alternar.mutate(c)}
                        aria-label="Ativar categoria"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AcoesLinha
                        onEdit={() => editar(c)}
                        onDelete={() => remover.mutateAsync(c.id).then(() => {})}
                        nome={c.nome}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="w-[calc(100%-2rem)] p-4 sm:max-w-md md:p-6">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar" : "Nova"} categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Comissões, Aluguel, Marketing"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "despesa" | "receita")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || nome.trim().length === 0}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------ Centros de custo / Formas ------------------ */

function SecaoSimples({
  entidade,
  titulo,
  descricao,
  singular,
  icon,
}: {
  entidade: Extract<ConfigEntidade, "centro" | "forma">;
  titulo: string;
  descricao: string;
  singular: string;
  icon: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useConfigs();
  const criar = useServerFn(criarConfig);
  const atualizar = useServerFn(atualizarConfig);
  const excluir = useServerFn(excluirConfig);

  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const salvar = useMutation({
    mutationFn: async () => {
      if (editId) return atualizar({ data: { entidade, id: editId, nome } });
      return criar({ data: { entidade, nome } });
    },
    onSuccess: () => {
      toast.success(editId ? "Registro atualizado." : "Registro criado.");
      setAberto(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const alternar = useMutation({
    mutationFn: (i: ConfigItem) => atualizar({ data: { entidade, id: i.id, ativo: !i.ativo } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => excluir({ data: { entidade, id } }),
    onSuccess: (r) => {
      toast.success(r.desativado ? "Registro desativado (em uso)." : "Registro removido.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    setEditId(null);
    setNome("");
    setAberto(true);
  }
  function editar(i: ConfigItem) {
    setEditId(i.id);
    setNome(i.nome);
    setAberto(true);
  }

  const itens = entidade === "centro" ? (data?.centrosCusto ?? []) : (data?.formasPagamento ?? []);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon} {titulo}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListaSkeleton />
        ) : itens.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum registro cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-28 text-center">Ativo</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={i.id} className={i.ativo ? "" : "opacity-60"}>
                    <TableCell className="font-medium text-foreground">{i.nome}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={i.ativo}
                        onCheckedChange={() => alternar.mutate(i)}
                        aria-label="Ativar registro"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AcoesLinha
                        onEdit={() => editar(i)}
                        onDelete={() => remover.mutateAsync(i.id).then(() => {})}
                        nome={i.nome}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="w-[calc(100%-2rem)] p-4 sm:max-w-md md:p-6">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar" : "Novo"} {singular}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || nome.trim().length === 0}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Shared ----------------------------- */

function AcoesLinha({
  onEdit,
  onDelete,
  nome,
}: {
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  nome: string;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <ConfirmDelete
        titulo={`Remover "${nome}"?`}
        descricao="Se houver lançamentos vinculados, o registro será apenas desativado."
        onConfirm={() => Promise.resolve(onDelete())}
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

function ListaSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
