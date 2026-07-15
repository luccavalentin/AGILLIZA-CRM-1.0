import { AdminHero } from "@/components/admin/admin-hero";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Timer,
  CalendarDays,
  Plus,
  Trash2,
  Pencil,
  Tags,
  ListChecks,
  Signal,
  
} from "lucide-react";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSlaConfiguracoes,
  salvarSlaConfiguracao,
  excluirSlaConfiguracao,
  listarFeriados,
  criarFeriado,
  excluirFeriado,
  listarCatalogoSla,
  salvarCatalogoItem,
  excluirCatalogoItem,
  type SlaConfig,
  type CatalogoItem,
  type CategoriaCatalogo,
} from "@/lib/admin/sla.functions";

export const Route = createFileRoute("/_authenticated/admin/sla")({
  head: () => ({ meta: [{ title: "SLA & Feriados — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.sla"),
  component: Pagina,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
});

/* ----------------------------- Catálogos hook ----------------------------- */

function useCatalogo(categoria: CategoriaCatalogo) {
  const listar = useServerFn(listarCatalogoSla);
  return useQuery({
    queryKey: ["admin-sla-catalogo", categoria],
    queryFn: () => listar({ data: { categoria } }),
  });
}

function mapaLabel(itens: CatalogoItem[] | undefined) {
  const m = new Map<string, string>();
  (itens ?? []).forEach((i) => m.set(i.valor, i.label));
  return m;
}

function Pagina() {
  const tipos = useCatalogo("tipo_demanda");
  const prioridades = useCatalogo("prioridade");
  const canais = useCatalogo("canal");

  return (
    <div className="mx-auto w-full max-w-none space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Timer className="h-5 w-5" />}
        titulo="SLA & Feriados"
        descricao="Prazos por tipo de demanda e prioridade (horas úteis), catálogos configuráveis e calendário de feriados."
      />

      <SecaoSla tipos={tipos.data} prioridades={prioridades.data} canais={canais.data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SecaoCatalogo
          categoria="tipo_demanda"
          titulo="Tipos de demanda"
          icon={<Tags className="h-4 w-4 text-muted-foreground" />}
          q={tipos}
        />
        <SecaoCatalogo
          categoria="prioridade"
          titulo="Prioridades"
          icon={<Signal className="h-4 w-4 text-muted-foreground" />}
          q={prioridades}
        />
      </div>

      <SecaoFeriados />
    </div>
  );
}

/* ----------------------------- SLA ----------------------------- */

interface SlaForm {
  id?: string;
  tipo: string;
  prioridade: string;
  horas_uteis: number;
  canal_escalonamento: string;
  ativo: boolean;
}

function SecaoSla({
  tipos,
  prioridades,
  canais,
}: {
  tipos?: CatalogoItem[];
  prioridades?: CatalogoItem[];
  canais?: CatalogoItem[];
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarSlaConfiguracoes);
  const salvar = useServerFn(salvarSlaConfiguracao);
  const excluir = useServerFn(excluirSlaConfiguracao);
  const [aberto, setAberto] = useState(false);

  const tipoMap = useMemo(() => mapaLabel(tipos), [tipos]);
  const prioMap = useMemo(() => mapaLabel(prioridades), [prioridades]);
  const canalMap = useMemo(() => mapaLabel(canais), [canais]);

  const vazio: SlaForm = {
    tipo: tipos?.[0]?.valor ?? "geral",
    prioridade: prioridades?.[1]?.valor ?? prioridades?.[0]?.valor ?? "p2",
    horas_uteis: 8,
    canal_escalonamento: canais?.[0]?.valor ?? "gestor",
    ativo: true,
  };
  const [form, setForm] = useState<SlaForm>(vazio);

  const { data, isLoading } = useQuery({ queryKey: ["admin-sla"], queryFn: () => listar() });

  const salvarM = useMutation({
    mutationFn: (f: SlaForm) => salvar({ data: f }),
    onSuccess: () => {
      toast.success("SLA salvo.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["admin-sla"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("SLA removido.");
      qc.invalidateQueries({ queryKey: ["admin-sla"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    setForm(vazio);
    setAberto(true);
  }
  function editar(s: SlaConfig) {
    setForm({ ...s });
    setAberto(true);
  }

  const tiposAtivos = (tipos ?? []).filter((t) => t.ativo);
  const priosAtivas = (prioridades ?? []).filter((p) => p.ativo);
  const canaisAtivos = (canais ?? []).filter((c) => c.ativo);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-muted-foreground" /> Configurações de SLA
        </CardTitle>
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
            Nenhuma regra de SLA. Sem regra, o padrão é P1=4h, P2=8h, P3=24h úteis.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Horas úteis</TableHead>
                <TableHead>Escalonar p/</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">
                    {tipoMap.get(s.tipo) ?? s.tipo}
                  </TableCell>
                  <TableCell>{prioMap.get(s.prioridade) ?? s.prioridade}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.horas_uteis}h</TableCell>
                  <TableCell>{canalMap.get(s.canal_escalonamento) ?? s.canal_escalonamento}</TableCell>
                  <TableCell>{s.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => editar(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDelete
                        titulo="Remover regra de SLA?"
                        descricao="Demandas passarão a usar o padrão do sistema."
                        onConfirm={() => excluirM.mutateAsync(s.id).then(() => {})}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Nova"} regra de SLA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de demanda</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivos.map((t) => (
                      <SelectItem key={t.id} value={t.valor}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priosAtivas.map((p) => (
                      <SelectItem key={p.id} value={p.valor}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Horas úteis</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.horas_uteis}
                  onChange={(e) => setForm((f) => ({ ...f, horas_uteis: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Escalonar para</Label>
                <Select
                  value={form.canal_escalonamento}
                  onValueChange={(v) => setForm((f) => ({ ...f, canal_escalonamento: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canaisAtivos.map((c) => (
                      <SelectItem key={c.id} value={c.valor}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="sla-ativo">Regra ativa</Label>
              <Switch
                id="sla-ativo"
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

/* --------------------------- Catálogos --------------------------- */

interface CatForm {
  id?: string;
  valor: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function SecaoCatalogo({
  categoria,
  titulo,
  icon,
  q,
}: {
  categoria: CategoriaCatalogo;
  titulo: string;
  icon: React.ReactNode;
  q: ReturnType<typeof useCatalogo>;
}) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarCatalogoItem);
  const excluir = useServerFn(excluirCatalogoItem);
  const [aberto, setAberto] = useState(false);
  const vazio: CatForm = { valor: "", label: "", ordem: 0, ativo: true };
  const [form, setForm] = useState<CatForm>(vazio);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-sla-catalogo", categoria] });

  const salvarM = useMutation({
    mutationFn: (f: CatForm) =>
      salvar({
        data: {
          id: f.id,
          categoria,
          valor: f.id ? f.valor : f.valor || slugify(f.label),
          label: f.label,
          ordem: f.ordem,
          ativo: f.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Item salvo.");
      setAberto(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao remover."),
  });

  function novo() {
    const prox = (q.data?.length ?? 0);
    setForm({ ...vazio, ordem: prox });
    setAberto(true);
  }
  function editar(i: CatalogoItem) {
    setForm({ id: i.id, valor: i.valor, label: i.label, ordem: i.ordem, ativo: i.ativo });
    setAberto(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {titulo}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item.</p>
        ) : (
          <ul className="divide-y divide-border">
            {q.data!.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{i.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.valor}
                    {!i.ativo && " · inativo"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => editar(i)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    titulo="Remover item?"
                    descricao="Regras de SLA que usam este valor deixarão de correspondê-lo."
                    onConfirm={() => excluirM.mutateAsync(i.id).then(() => {})}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar" : "Novo"} — {titulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome exibido</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex.: Análise de documento"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código {form.id ? "" : "(opcional)"}</Label>
              <Input
                value={form.valor}
                disabled={!!form.id}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="gerado automaticamente"
              />
              <p className="text-xs text-muted-foreground">
                Letras, números e sublinhado. Não pode ser alterado depois de criado.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.ordem}
                  onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-end justify-between rounded-md border border-border p-3">
                <Label htmlFor={`cat-ativo-${categoria}`}>Ativo</Label>
                <Switch
                  id={`cat-ativo-${categoria}`}
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (form.label.trim().length < 1) return toast.error("Informe o nome.");
                salvarM.mutate(form);
              }}
              disabled={salvarM.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* --------------------------- Feriados --------------------------- */

function SecaoFeriados() {
  const qc = useQueryClient();
  const listar = useServerFn(listarFeriados);
  const criar = useServerFn(criarFeriado);
  const excluir = useServerFn(excluirFeriado);
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: feriados, isLoading } = useQuery({
    queryKey: ["admin-feriados"],
    queryFn: () => listar(),
  });

  const criarM = useMutation({
    mutationFn: () => criar({ data: { data, descricao } }),
    onSuccess: () => {
      toast.success("Feriado cadastrado.");
      setData("");
      setDescricao("");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Feriado removido.");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não é possível remover feriados globais."),
  });

  function adicionar() {
    if (!data) return toast.error("Informe a data.");
    if (descricao.trim().length < 2) return toast.error("Informe a descrição.");
    criarM.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Feriados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full sm:w-44"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Feriado municipal"
            />
          </div>
          <Button onClick={adicionar} disabled={criarM.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (feriados?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum feriado cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feriados!.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="tabular-nums">
                    {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </TableCell>
                  <TableCell className="text-foreground">{f.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.correspondente_id ? "Meu" : "Nacional"}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.correspondente_id ? (
                      <ConfirmDelete
                        titulo="Remover feriado?"
                        onConfirm={() => excluirM.mutateAsync(f.id).then(() => {})}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
