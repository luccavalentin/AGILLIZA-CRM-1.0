import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { validarEmail } from "@/lib/crm/documento";
import { Loader2, ShieldCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  type EscopoDados,
  type NivelAcesso,
} from "@/lib/admin/regras-modulos.functions";
import {
  criarPessoaComAcesso,
  type CriarPessoaInput,
  type ResultadoCriarPessoa,
} from "@/lib/admin/pessoas.functions";
import { listarTiposPessoa } from "@/lib/admin/tipos-pessoa.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
// Mesmos rótulos da matriz: a lista local só tinha "todos" e "próprios" e
// mostrava "equipe"/"personalizado" crus.
import { ESCOPOS } from "./regras-modulos/constants";

type MatrizEstado = Record<string, { permitido: boolean; escopo: EscopoDados }>;


const chave = (modulo: string, acao: string) => `${modulo}:${acao}`;

function estadoInicial(nivel: NivelAcesso | undefined): MatrizEstado {
  const estado: MatrizEstado = {};
  for (const mod of CATALOGO_MODULOS) {
    for (const a of mod.acoes) {
      const atual = nivel?.permissoes.find((p) => p.modulo === mod.modulo && p.acao === a.acao);
      estado[chave(mod.modulo, a.acao)] = {
        permitido: atual?.permitido ?? false,
        escopo: atual?.escopo_dados ?? "proprios",
      };
    }
  }
  return estado;
}

const grupos = Array.from(new Set(CATALOGO_MODULOS.map((m) => m.grupo)));

/**
 * Cadastro de pessoa. As permissões do nível aparecem só para leitura: elas
 * valem para TODAS as pessoas do nível, então editar aqui (como era antes)
 * mudava o acesso de todo mundo para quem só queria cadastrar alguém. A edição
 * fica em "Papéis & Permissões" (`onAbrirPermissoes`).
 */
export function NovaPessoaInline({
  onCreated,
  onCancel,
  onAbrirPermissoes,
}: {
  onCreated: (res: ResultadoCriarPessoa) => void;
  onCancel: () => void;
  onAbrirPermissoes?: () => void;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tiposPessoa, setTiposPessoa] = useState<string[]>([]);
  const [comLogin, setComLogin] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");

  const [comissao, setComissao] = useState("");
  const [nivelId, setNivelId] = useState<string>("");

  const [estado, setEstado] = useState<MatrizEstado>({});
  const [carregadoPara, setCarregadoPara] = useState("");

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  // Seleciona o primeiro nível automaticamente.
  if (niveis && niveis.length > 0 && !nivelId) {
    setNivelId(niveis[0].id);
  }

  const listarTipos = useServerFn(listarTiposPessoa);
  const { data: tipos } = useQuery({
    queryKey: ["tipos-pessoa"],
    queryFn: () => listarTipos(),
  });
  const tiposAtivos = useMemo(() => (tipos ?? []).filter((t) => t.ativo), [tipos]);
  const tipoSel = useMemo(
    () => tiposAtivos.find((t) => t.slug === tiposPessoa[0]),
    [tiposAtivos, tiposPessoa],
  );

  // Seleciona o primeiro tipo automaticamente (e aplica o login padrão dele).
  if (tiposAtivos.length > 0 && tiposPessoa.length === 0) {
    setTiposPessoa([tiposAtivos[0].slug]);
    setComLogin(tiposAtivos[0].login_padrao);
  }

  const nivel = useMemo(() => (niveis ?? []).find((n) => n.id === nivelId), [niveis, nivelId]);
  const isParceiro = nivel?.acesso_tipo === "portal_parceiro";

  // Carrega a matriz sempre que o nível muda.
  if (nivel && carregadoPara !== nivel.id) {
    setEstado(estadoInicial(nivel));
    setCarregadoPara(nivel.id);
  }

  const criar = useMutation({
    mutationFn: (payload: CriarPessoaInput) => criarPessoaComAcesso({ data: payload }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      onCreated(res);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e, "Não foi possível concluir a operação.")),
  });

  // Tipos de acesso "parceiro" podem existir sem login; internos exigem login.
  const permiteSemLogin = tipoSel?.acesso_tipo === "portal_parceiro";
  const efetivoComLogin = permiteSemLogin ? comLogin : true;

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe o nome completo.");
    if (efetivoComLogin && !email.trim())
      return toast.error("Informe o e-mail para pessoas com acesso ao sistema.");
    if (efetivoComLogin && !validarEmail(email)) return toast.error("E-mail inválido.");
    if (!nivelId) return toast.error("Selecione um nível de acesso.");

    criar.mutate({
      nome: nome.trim(),
      email: efetivoComLogin ? email.trim() : "",
      nivel_acesso_id: nivelId,
      tipo_pessoa: tiposPessoa[0],
      tipos_pessoa: tiposPessoa,
      com_login: efetivoComLogin,
      avatar_url: avatarUrl.trim() || undefined,
      dados_parceiro: isParceiro
        ? {
            // Aceita "2,5" e "2.5".
            comissao_padrao: comissao ? Number(comissao.replace(",", ".")) : undefined,
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Fechar cadastro"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tipo de pessoa */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipos de pessoa</Label>
            <div className="flex flex-wrap gap-2">
              {tiposAtivos.map((t) => {
                const ativo = tiposPessoa.includes(t.slug);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setTiposPessoa((prev) => {
                        if (prev.includes(t.slug)) {
                          const next = prev.filter((s) => s !== t.slug);
                          return next.length > 0 ? next : prev;
                        }
                        const next = [...prev, t.slug];
                        if (next.length === 1) setComLogin(t.login_padrao);
                        return next;
                      })
                    }
                    className={
                      "rounded-full border px-3 py-1 text-sm transition-colors " +
                      (ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted")
                    }
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Pode marcar mais de um. Os privilégios somam o acesso mais amplo.
            </p>
          </div>
          {permiteSemLogin && (
            <div className="space-y-2">
              <Label>Acesso ao sistema</Label>
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch
                  aria-label="Acesso ao sistema"
                  id="np-login"
                  checked={comLogin}
                  onCheckedChange={setComLogin}
                />
                <Label htmlFor="np-login" className="cursor-pointer text-sm font-normal">
                  {comLogin
                    ? "Com login (acessa o Portal do Parceiro)"
                    : "Sem login (aparece nas buscas; habilite depois)"}
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Dados básicos */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="np-nome">Nome completo</Label>
            <Input
              id="np-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              placeholder="Ex.: MARIA SILVA"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np-email">{efetivoComLogin ? "E-mail" : "E-mail (opcional)"}</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              required={efetivoComLogin}
              disabled={!efetivoComLogin}
            />
            {!efetivoComLogin && (
              <p className="text-xs text-muted-foreground">
                Sem login, o e-mail não é necessário agora. Você pode habilitar o acesso depois na
                lista de pessoas.
              </p>
            )}
          </div>
        </div>

        {/* Foto do Perfil */}
        <div className="space-y-2">
          <Label htmlFor="np-avatar">Link da foto de perfil (opcional)</Label>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted shadow-inner ring-1 ring-border">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : nome.trim() ? (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold">
                  {nome.charAt(0)}
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/30">
                  <UserPlus className="h-6 w-6" />
                </div>
              )}
            </div>
            <Input
              id="np-avatar"
              placeholder="https://exemplo.com/foto.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Insira um link direto para a imagem.</p>
        </div>

        {/* Campos de parceiro — exibidos quando o nível é do Portal do Parceiro */}
        {isParceiro && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="np-com">% comissão</Label>
              <Input
                id="np-com"
                type="number"
                step="0.01"
                value={comissao || ""}
                onChange={(e) => setComissao(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Nível de acesso — define papel (Gestor, Corretor, etc.) e portal */}
        <div className="space-y-2">
          <Label>Nível de acesso</Label>
          <Select value={nivelId} onValueChange={setNivelId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o nível de acesso" />
            </SelectTrigger>
            <SelectContent>
              {(niveis ?? []).map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.nome}
                  {n.acesso_tipo === "portal_parceiro" ? " · Parceiro" : " · Correspondente"}
                  {n.is_padrao ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {nivel?.descricao && <p className="text-xs text-muted-foreground">{nivel.descricao}</p>}
        </div>

        {/* Permissões do nível — somente leitura no cadastro */}
        {nivel && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">O que esta pessoa vai poder ver e editar</p>
                <p className="text-xs text-muted-foreground">
                  Vem do nível “{nivel.nome}” e vale para todas as pessoas com esse nível. Para
                  mudar, use Papéis & Permissões.
                </p>
              </div>
              {onAbrirPermissoes && (
                <Button type="button" size="sm" variant="outline" onClick={onAbrirPermissoes}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Papéis & Permissões
                </Button>
              )}
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {(() => {
                const porGrupo = grupos
                  .map((grupo) => ({
                    grupo,
                    modulos: CATALOGO_MODULOS.filter((m) => m.grupo === grupo)
                      .map((mod) => ({
                        mod,
                        acoes: mod.acoes.filter(
                          (a) => estado[chave(mod.modulo, a.acao)]?.permitido,
                        ),
                      }))
                      .filter((x) => x.acoes.length > 0),
                  }))
                  .filter((g) => g.modulos.length > 0);
                if (porGrupo.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Este nível ainda não libera nenhum módulo.
                    </p>
                  );
                }
                return porGrupo.map(({ grupo, modulos }) => (
                  <div key={grupo} className="space-y-1.5">
                    <Badge variant="secondary">{grupo}</Badge>
                    <ul className="space-y-1 text-sm">
                      {modulos.map(({ mod, acoes }) => {
                        const escopo =
                          estado[chave(mod.modulo, acoes[0].acao)]?.escopo ?? "proprios";
                        return (
                          <li key={mod.modulo} className="flex flex-wrap gap-x-1.5">
                            <span className="font-medium">{mod.label}:</span>
                            <span className="text-muted-foreground">
                              {acoes.map((a) => a.label).join(", ")} ·{" "}
                              {ESCOPOS.find((e) => e.value === escopo)?.label ?? escopo}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ));
              })()}
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
