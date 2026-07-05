import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Loader2, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  CATALOGO_MODULOS,
  listarNiveisAcesso,
  criarNivelAcesso,
  salvarPermissoes,
  type EscopoDados,
  type NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/regras-modulos")({
  head: () => ({ meta: [{ title: "Regras & Módulos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.regras"),
  component: Pagina,
});

type MatrizEstado = Record<string, { permitido: boolean; escopo: EscopoDados }>;

const ESCOPOS: { value: EscopoDados; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "equipe", label: "Equipe" },
  { value: "proprios", label: "Próprios" },
];

const chave = (modulo: string, acao: string) => `${modulo}:${acao}`;

function estadoInicial(nivel: NivelAcesso): MatrizEstado {
  const estado: MatrizEstado = {};
  for (const mod of CATALOGO_MODULOS) {
    for (const a of mod.acoes) {
      const atual = nivel.permissoes.find((p) => p.modulo === mod.modulo && p.acao === a.acao);
      estado[chave(mod.modulo, a.acao)] = {
        permitido: atual?.permitido ?? false,
        escopo: atual?.escopo_dados ?? "proprios",
      };
    }
  }
  return estado;
}

function Pagina() {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const criar = useServerFn(criarNivelAcesso);
  const salvar = useServerFn(salvarPermissoes);

  const { data: niveis, isLoading } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<MatrizEstado>({});
  const [dirty, setDirty] = useState(false);

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");

  const selecionado = useMemo(() => {
    const lista = niveis ?? [];
    return lista.find((n) => n.id === selecionadoId) ?? lista[0] ?? null;
  }, [niveis, selecionadoId]);

  // Sincroniza a matriz quando muda o nível selecionado.
  const nivelKey = selecionado?.id ?? "";
  const [carregadoPara, setCarregadoPara] = useState("");
  if (selecionado && carregadoPara !== nivelKey) {
    setEstado(estadoInicial(selecionado));
    setCarregadoPara(nivelKey);
    setDirty(false);
  }

  const criarMut = useMutation({
    mutationFn: (v: { nome: string; descricao?: string }) => criar({ data: v }),
    onSuccess: async (r) => {
      toast.success("Nível de acesso criado.");
      setNovoOpen(false);
      setNovoNome("");
      setNovaDesc("");
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      setSelecionadoId(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarMut = useMutation({
    mutationFn: () => {
      if (!selecionado) throw new Error("Selecione um nível.");
      const permissoes = Object.entries(estado).map(([k, v]) => {
        const [modulo, acao] = k.split(":");
        return { modulo, acao, permitido: v.permitido, escopo_dados: v.escopo };
      });
      return salvar({ data: { nivel_acesso_id: selecionado.id, permissoes } });
    },
    onSuccess: async () => {
      toast.success("Permissões salvas.");
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editavel = selecionado?.editavel ?? false;

  function toggle(modulo: string, acao: string, permitido: boolean) {
    setEstado((prev) => ({ ...prev, [chave(modulo, acao)]: { ...prev[chave(modulo, acao)], permitido } }));
    setDirty(true);
  }
  function setEscopo(modulo: string, escopo: EscopoDados) {
    setEstado((prev) => {
      const next = { ...prev };
      for (const a of CATALOGO_MODULOS.find((m) => m.modulo === modulo)?.acoes ?? []) {
        const k = chave(modulo, a.acao);
        next[k] = { ...next[k], escopo };
      }
      return next;
    });
    setDirty(true);
  }

  const grupos = useMemo(() => {
    const map = new Map<string, typeof CATALOGO_MODULOS>();
    for (const m of CATALOGO_MODULOS) {
      const arr = map.get(m.grupo) ?? [];
      arr.push(m);
      map.set(m.grupo, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Regras & Módulos</h1>
          <p className="text-sm text-muted-foreground">
            Defina o que cada nível de acesso pode ver e fazer em cada módulo.
          </p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Novo nível
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo nível de acesso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Supervisor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Input id="desc" value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => criarMut.mutate({ nome: novoNome.trim(), descricao: novaDesc.trim() || undefined })}
                disabled={novoNome.trim().length < 2 || criarMut.isPending}
              >
                {criarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Lista de níveis */}
          <div className="space-y-2">
            {(niveis ?? []).map((n) => {
              const ativo = selecionado?.id === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelecionadoId(n.id)}
                  className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                    ativo ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50"
                  }`}
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{n.nome}</span>
                      {n.is_padrao ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Padrão
                        </Badge>
                      ) : null}
                    </div>
                    {n.descricao ? (
                      <p className="truncate text-xs text-muted-foreground">{n.descricao}</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Matriz */}
          <div className="space-y-4">
            {selecionado ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-foreground">{selecionado.nome}</h2>
                    {!editavel ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> Somente leitura
                      </Badge>
                    ) : null}
                  </div>
                  <Button onClick={() => salvarMut.mutate()} disabled={!editavel || !dirty || salvarMut.isPending}>
                    {salvarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
                  </Button>
                </div>
                {!editavel ? (
                  <p className="text-sm text-muted-foreground">
                    Níveis padrão não podem ser editados. Crie um nível customizado para ajustar permissões.
                  </p>
                ) : null}

                {grupos.map(([grupo, mods]) => (
                  <Card key={grupo} className="overflow-hidden">
                    <div className="border-b border-border bg-muted/40 px-4 py-2">
                      <h3 className="text-sm font-semibold text-foreground">{grupo}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {mods.map((mod) => {
                        const escopoAtual = estado[chave(mod.modulo, mod.acoes[0].acao)]?.escopo ?? "proprios";
                        return (
                          <div key={mod.modulo} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-[140px]">
                              <p className="text-sm font-medium text-foreground">{mod.label}</p>
                              <p className="text-xs text-muted-foreground">{mod.modulo}</p>
                            </div>
                            <div className="flex flex-1 flex-wrap gap-x-5 gap-y-2">
                              {mod.acoes.map((a) => {
                                const st = estado[chave(mod.modulo, a.acao)];
                                return (
                                  <label key={a.acao} className="flex items-center gap-2 text-sm text-foreground">
                                    <Checkbox
                                      checked={st?.permitido ?? false}
                                      disabled={!editavel}
                                      onCheckedChange={(v) => toggle(mod.modulo, a.acao, v === true)}
                                    />
                                    {a.label}
                                  </label>
                                );
                              })}
                            </div>
                            <div className="w-full lg:w-40">
                              <Select
                                value={escopoAtual}
                                disabled={!editavel}
                                onValueChange={(v) => setEscopo(mod.modulo, v as EscopoDados)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Escopo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ESCOPOS.map((e) => (
                                    <SelectItem key={e.value} value={e.value}>
                                      {e.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum nível de acesso encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
