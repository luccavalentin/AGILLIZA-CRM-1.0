import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Loader2, ShieldCheck, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CATALOGO_MODULOS,
  PAPEIS_POR_PORTAL,
  listarNiveisAcesso,
  criarNivelAcesso,
  atualizarNivelAcesso,
  excluirNivelAcesso,
  salvarPermissoes,
  type AcessoTipo,
  type EscopoDados,
  type NivelAcesso,
  type PapelNivel,
} from "@/lib/admin/regras-modulos.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MatrizEstado = Record<string, { permitido: boolean; escopo: EscopoDados }>;

const ESCOPOS: { value: EscopoDados; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "equipe", label: "Equipe" },
  { value: "proprios", label: "Próprios" },
];

const PORTAIS: { value: AcessoTipo; label: string }[] = [
  { value: "sistema", label: "Portal do Correspondente" },
  { value: "portal_parceiro", label: "Portal do Parceiro" },
];

const PAPEL_LABEL: Record<string, string> = {
  gestor: "Gestor",
  comercial: "Comercial",
  analista: "Analista",
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
};

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

export function RegrasModulosPanel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const criar = useServerFn(criarNivelAcesso);
  const atualizar = useServerFn(atualizarNivelAcesso);
  const excluir = useServerFn(excluirNivelAcesso);
  const salvar = useServerFn(salvarPermissoes);

  const { data: niveis, isLoading } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  const [subaba, setSubaba] = useState<"papeis" | "permissoes">("papeis");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<MatrizEstado>({});
  const [dirty, setDirty] = useState(false);

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [copiarDe, setCopiarDe] = useState<string>("baseline");
  const [novoPortal, setNovoPortal] = useState<AcessoTipo>("sistema");
  const [novoPapel, setNovoPapel] = useState<PapelNivel>("comercial");

  const [editarOpen, setEditarOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPortal, setEditPortal] = useState<AcessoTipo>("sistema");
  const [editPapel, setEditPapel] = useState<PapelNivel>("comercial");

  const [excluirOpen, setExcluirOpen] = useState(false);

  const selecionado = useMemo(() => {
    const lista = niveis ?? [];
    return lista.find((n) => n.id === selecionadoId) ?? lista[0] ?? null;
  }, [niveis, selecionadoId]);

  const nivelKey = selecionado?.id ?? "";
  const [carregadoPara, setCarregadoPara] = useState("");
  if (selecionado && carregadoPara !== nivelKey) {
    setEstado(estadoInicial(selecionado));
    setCarregadoPara(nivelKey);
    setDirty(false);
  }

  const criarMut = useMutation({
    mutationFn: (v: {
      nome: string;
      descricao?: string;
      copiar_de?: string;
      papel: PapelNivel;
      acesso_tipo: AcessoTipo;
    }) => criar({ data: v }),
    onSuccess: async (r) => {
      toast.success("Nível de acesso criado com permissões iniciais.");
      setNovoOpen(false);
      setNovoNome("");
      setNovaDesc("");
      setCopiarDe("baseline");
      setNovoPortal("sistema");
      setNovoPapel("comercial");
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      setSelecionadoId(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarMut = useMutation({
    mutationFn: (v: {
      id: string;
      nome: string;
      descricao?: string;
      papel: PapelNivel;
      acesso_tipo: AcessoTipo;
    }) => atualizar({ data: v }),
    onSuccess: async (r: any) => {
      toast.success(
        r?.clonado
          ? "Criamos uma cópia editável do nível padrão com o novo nome."
          : "Nível atualizado.",
      );
      setEditarOpen(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      if (r?.id) {
        setSelecionadoId(r.id);
        setCarregadoPara("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: async () => {
      toast.success("Nível excluído.");
      setExcluirOpen(false);
      setSelecionadoId(null);
      setCarregadoPara("");
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
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
    onSuccess: async (r: any) => {
      toast.success(
        r?.clonado
          ? "Criamos uma cópia editável do nível padrão com essas permissões."
          : "Permissões salvas.",
      );
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      if (r?.nivel_acesso_id) {
        setSelecionadoId(r.nivel_acesso_id);
        setCarregadoPara("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editavel = selecionado?.editavel ?? false;

  function toggle(modulo: string, acao: string, permitido: boolean) {
    setEstado((prev) => ({
      ...prev,
      [chave(modulo, acao)]: { ...prev[chave(modulo, acao)], permitido },
    }));
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

  function abrirEditar() {
    if (!selecionado) return;
    setEditNome(selecionado.nome);
    setEditDesc(selecionado.descricao ?? "");
    setEditPortal(selecionado.acesso_tipo);
    setEditPapel(selecionado.papel);
    setEditarOpen(true);
  }

  // Garante papel válido ao trocar de portal.
  function ajustarPapel(portal: AcessoTipo, papel: PapelNivel): PapelNivel {
    const opcoes = PAPEIS_POR_PORTAL[portal].map((p) => p.value);
    return opcoes.includes(papel) ? papel : opcoes[0];
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
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Regras & Módulos</h2>
          <p className="text-sm text-muted-foreground">
            Defina o que cada nível de acesso pode ver e fazer em cada módulo.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4" /> Novo nível
        </Button>
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
                    <p className="truncate text-xs text-muted-foreground">
                      {PAPEL_LABEL[n.papel] ?? n.papel} ·{" "}
                      {n.acesso_tipo === "portal_parceiro" ? "Parceiro" : "Correspondente"}
                    </p>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium text-foreground">{selecionado.nome}</h2>
                    <Badge variant="outline">
                      {PAPEL_LABEL[selecionado.papel] ?? selecionado.papel}
                    </Badge>
                    <Badge variant="outline">
                      {selecionado.acesso_tipo === "portal_parceiro"
                        ? "Portal do Parceiro"
                        : "Portal do Correspondente"}
                    </Badge>
                    {selecionado.is_padrao ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> Padrão
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {editavel ? (
                      <>
                        <Button variant="outline" size="sm" onClick={abrirEditar}>
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                        {!selecionado.is_padrao ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setExcluirOpen(true)}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <Button
                      onClick={() => salvarMut.mutate()}
                      disabled={!editavel || !dirty || salvarMut.isPending}
                    >
                      {salvarMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}{" "}
                      Salvar
                    </Button>
                  </div>
                </div>
                {!editavel ? (
                  <p className="text-sm text-muted-foreground">
                    Você não tem permissão para editar níveis de acesso.
                  </p>
                ) : selecionado.is_padrao ? (
                  <p className="text-sm text-muted-foreground">
                    Este é um nível padrão do sistema. Ao renomear ou salvar permissões, criaremos
                    automaticamente uma cópia editável — que você poderá ajustar e excluir
                    livremente.
                  </p>
                ) : null}

                {grupos.map(([grupo, mods]) => (
                  <Card key={grupo} className="overflow-hidden">
                    <div className="border-b border-border bg-muted/40 px-4 py-2">
                      <h3 className="text-sm font-semibold text-foreground">{grupo}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {mods.map((mod) => {
                        const escopoAtual =
                          estado[chave(mod.modulo, mod.acoes[0].acao)]?.escopo ?? "proprios";
                        return (
                          <div
                            key={mod.modulo}
                            className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="min-w-[140px]">
                              <p className="text-sm font-medium text-foreground">{mod.label}</p>
                              <p className="text-xs text-muted-foreground">{mod.modulo}</p>
                            </div>
                            <div className="flex flex-1 flex-wrap gap-x-5 gap-y-2">
                              {mod.acoes.map((a) => {
                                const st = estado[chave(mod.modulo, a.acao)];
                                return (
                                  <label
                                    key={a.acao}
                                    className="flex items-center gap-2 text-sm text-foreground"
                                  >
                                    <Checkbox
                                      checked={st?.permitido ?? false}
                                      disabled={!editavel}
                                      onCheckedChange={(v) =>
                                        toggle(mod.modulo, a.acao, v === true)
                                      }
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

      {/* Dialog: novo nível */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo nível de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Supervisor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                value={novaDesc}
                onChange={(e) => setNovaDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Portal</Label>
                <Select
                  value={novoPortal}
                  onValueChange={(v) => {
                    const p = v as AcessoTipo;
                    setNovoPortal(p);
                    setNovoPapel(ajustarPapel(p, novoPapel));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAIS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Papel / função</Label>
                <Select value={novoPapel} onValueChange={(v) => setNovoPapel(v as PapelNivel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS_POR_PORTAL[novoPortal].map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Começar as permissões a partir de</Label>
              <Select value={copiarDe} onValueChange={setCopiarDe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Somente visualização (padrão)</SelectItem>
                  {(niveis ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      Copiar de: {n.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O nível já nasce com uma matriz de permissões que você pode ajustar em seguida.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                criarMut.mutate({
                  nome: novoNome.trim(),
                  descricao: novaDesc.trim() || undefined,
                  copiar_de: copiarDe === "baseline" ? undefined : copiarDe,
                  papel: novoPapel,
                  acesso_tipo: novoPortal,
                })
              }
              disabled={novoNome.trim().length < 2 || criarMut.isPending}
            >
              {criarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar nível */}
      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nível de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descrição</Label>
              <Input
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Portal</Label>
                <Select
                  value={editPortal}
                  onValueChange={(v) => {
                    const p = v as AcessoTipo;
                    setEditPortal(p);
                    setEditPapel(ajustarPapel(p, editPapel));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAIS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Papel / função</Label>
                <Select value={editPapel} onValueChange={(v) => setEditPapel(v as PapelNivel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS_POR_PORTAL[editPortal].map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                selecionado &&
                atualizarMut.mutate({
                  id: selecionado.id,
                  nome: editNome.trim(),
                  descricao: editDesc.trim() || undefined,
                  papel: editPapel,
                  acesso_tipo: editPortal,
                })
              }
              disabled={editNome.trim().length < 2 || atualizarMut.isPending}
            >
              {atualizarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: excluir nível */}
      <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nível de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o nível “{selecionado?.nome}” e todas as suas permissões. Não é
              possível excluir se houver pessoas usando este nível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (selecionado) excluirMut.mutate(selecionado.id);
              }}
              disabled={excluirMut.isPending}
            >
              {excluirMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
