import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Loader2, Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOGO_MODULOS,
  listarNiveisAcesso,
  salvarPermissoes,
  type EscopoDados,
  type NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";
import {
  criarPessoaComAcesso,
  type CriarPessoaInput,
  type ResultadoCriarPessoa,
} from "@/lib/admin/pessoas.functions";

type Portal = "correspondente" | "parceiro";
type MatrizEstado = Record<string, { permitido: boolean; escopo: EscopoDados }>;

const ESCOPOS: { value: EscopoDados; label: string }[] = [
  { value: "todos", label: "Todos os dados" },
  { value: "equipe", label: "Dados da equipe" },
  { value: "proprios", label: "Apenas os próprios" },
];

const chave = (modulo: string, acao: string) => `${modulo}:${acao}`;

function estadoInicial(nivel: NivelAcesso | undefined): MatrizEstado {
  const estado: MatrizEstado = {};
  for (const mod of CATALOGO_MODULOS) {
    for (const a of mod.acoes) {
      const atual = nivel?.permissoes.find(
        (p) => p.modulo === mod.modulo && p.acao === a.acao,
      );
      estado[chave(mod.modulo, a.acao)] = {
        permitido: atual?.permitido ?? false,
        escopo: atual?.escopo_dados ?? "proprios",
      };
    }
  }
  return estado;
}

const grupos = Array.from(new Set(CATALOGO_MODULOS.map((m) => m.grupo)));

export function NovaPessoaInline({
  onCreated,
  onCancel,
}: {
  onCreated: (res: ResultadoCriarPessoa) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const salvar = useServerFn(salvarPermissoes);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [creci, setCreci] = useState("");
  const [comissao, setComissao] = useState("");
  const [nivelId, setNivelId] = useState<string>("");

  const [estado, setEstado] = useState<MatrizEstado>({});
  const [carregadoPara, setCarregadoPara] = useState("");
  const [permDirty, setPermDirty] = useState(false);

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  // Seleciona o primeiro nível automaticamente.
  if (niveis && niveis.length > 0 && !nivelId) {
    setNivelId(niveis[0].id);
  }

  const nivel = useMemo(
    () => (niveis ?? []).find((n) => n.id === nivelId),
    [niveis, nivelId],
  );

  // Carrega a matriz sempre que o nível muda.
  if (nivel && carregadoPara !== nivel.id) {
    setEstado(estadoInicial(nivel));
    setCarregadoPara(nivel.id);
    setPermDirty(false);
  }

  const salvarPermMut = useMutation({
    mutationFn: () => {
      if (!nivelId) throw new Error("Selecione um nível de acesso.");
      const permissoes = Object.entries(estado).map(([k, v]) => {
        const [modulo, acao] = k.split(":");
        return { modulo, acao, permitido: v.permitido, escopo_dados: v.escopo };
      });
      return salvar({ data: { nivel_acesso_id: nivelId, permissoes } });
    },
    onSuccess: async (r: { nivel_acesso_id?: string }) => {
      toast.success("Permissões do nível salvas.");
      setPermDirty(false);
      await qc.invalidateQueries({ queryKey: ["niveis-acesso"] });
      if (r?.nivel_acesso_id) {
        setNivelId(r.nivel_acesso_id);
        setCarregadoPara("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: (payload: CriarPessoaInput) =>
      criarPessoaComAcesso({ data: payload }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      onCreated(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(modulo: string, acao: string, permitido: boolean) {
    setEstado((prev) => ({
      ...prev,
      [chave(modulo, acao)]: { ...prev[chave(modulo, acao)], permitido },
    }));
    setPermDirty(true);
  }

  function setEscopoModulo(modulo: string, escopo: EscopoDados) {
    setEstado((prev) => {
      const next = { ...prev };
      for (const a of CATALOGO_MODULOS.find((m) => m.modulo === modulo)?.acoes ??
        []) {
        const k = chave(modulo, a.acao);
        next[k] = { ...next[k], escopo };
      }
      return next;
    });
    setPermDirty(true);
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe o nome completo.");
    if (!email.trim()) return toast.error("Informe o e-mail.");
    if (!nivelId) return toast.error("Selecione um nível de acesso.");

    criar.mutate({
      nome: nome.trim(),
      email: email.trim(),
      acesso_tipo: portal === "parceiro" ? "portal_parceiro" : "sistema",
      papel: portal === "parceiro" ? tipoParceiro : "comercial",
      nivel_acesso_id: nivelId,
      dados_parceiro:
        portal === "parceiro"
          ? {
              creci: creci.trim() || undefined,
              comissao_padrao: comissao ? Number(comissao) : undefined,
            }
          : undefined,
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={submeter} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Nova pessoa</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Dados básicos */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="np-nome">Nome completo</Label>
            <Input
              id="np-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria Silva"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-email">E-mail</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              required
            />
          </div>
        </div>

        {/* Portal de acesso */}
        <div className="space-y-2">
          <Label>Portal de acesso</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  value: "correspondente" as Portal,
                  titulo: "Portal do Correspondente",
                  desc: "Equipe interna. Acessa o sistema em /dashboard.",
                },
                {
                  value: "parceiro" as Portal,
                  titulo: "Portal do Parceiro",
                  desc: "Imobiliária ou corretor. Acessa apenas /parceiro.",
                },
              ]
            ).map((opt) => {
              const ativo = portal === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setPortal(opt.value)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    ativo
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Building2
                    className={`mt-0.5 h-5 w-5 ${ativo ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.titulo}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos de parceiro */}
        {portal === "parceiro" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de parceiro</Label>
              <Select
                value={tipoParceiro}
                onValueChange={(v) =>
                  setTipoParceiro(v as "imobiliaria" | "corretor")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretor">Corretor</SelectItem>
                  <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-creci">CRECI</Label>
              <Input
                id="np-creci"
                value={creci}
                onChange={(e) => setCreci(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-com">% comissão</Label>
              <Input
                id="np-com"
                type="number"
                step="0.01"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Nível de acesso */}
        <div className="space-y-2">
          <Label>Tipo de acesso (nível)</Label>
          <Select value={nivelId} onValueChange={setNivelId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o nível de acesso" />
            </SelectTrigger>
            <SelectContent>
              {(niveis ?? []).map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.nome}
                  {n.is_padrao ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {nivel?.descricao && (
            <p className="text-xs text-muted-foreground">{nivel.descricao}</p>
          )}
        </div>

        {/* Permissões do nível */}
        {nivel && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Permissões de acesso — o que esta pessoa pode ver e editar
                </p>
                <p className="text-xs text-muted-foreground">
                  As permissões são vinculadas ao nível “{nivel.nome}”. Alterar
                  aqui afeta todas as pessoas com esse nível.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!permDirty || salvarPermMut.isPending}
                onClick={() => salvarPermMut.mutate()}
              >
                {salvarPermMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar permissões
              </Button>
            </div>

            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {grupos.map((grupo) => (
                <div key={grupo} className="space-y-2">
                  <Badge variant="secondary">{grupo}</Badge>
                  <div className="space-y-2">
                    {CATALOGO_MODULOS.filter((m) => m.grupo === grupo).map(
                      (mod) => {
                        const escopoAtual =
                          estado[chave(mod.modulo, mod.acoes[0].acao)]?.escopo ??
                          "proprios";
                        return (
                          <div
                            key={mod.modulo}
                            className="rounded-md border p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {mod.label}
                              </span>
                              <Select
                                value={escopoAtual}
                                onValueChange={(v) =>
                                  setEscopoModulo(mod.modulo, v as EscopoDados)
                                }
                              >
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue />
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
                            <div className="mt-2 flex flex-wrap gap-4">
                              {mod.acoes.map((a) => {
                                const k = chave(mod.modulo, a.acao);
                                return (
                                  <label
                                    key={a.acao}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={estado[k]?.permitido ?? false}
                                      onCheckedChange={(c) =>
                                        toggle(mod.modulo, a.acao, c === true)
                                      }
                                    />
                                    {a.label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Criar pessoa
          </Button>
        </div>
      </form>
    </Card>
  );
}
