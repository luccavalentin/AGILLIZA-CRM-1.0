import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle2,
  Handshake,
  Trash2,
  LogIn,
  Users,
  ShieldAlert,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  BarraFiltros,
  CabecalhoGestao,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegrasModulosPanel } from "@/components/admin/regras-modulos-panel";
import { TiposPessoaPanel } from "@/components/admin/tipos-pessoa-panel";
import { listarTiposPessoa } from "@/lib/admin/tipos-pessoa.functions";
import { NovaPessoaInline } from "@/components/admin/nova-pessoa-inline";
import { EditarPessoaDialog } from "@/components/admin/editar-pessoa-dialog";
import { getMinhaSessao } from "@/lib/session.functions";
import {
  listarPessoas,
  alternarStatusPessoa,
  resetarSenhaPessoa,
  excluirPessoa,
  habilitarLoginPessoa,
  type PessoaLista,
  type ResultadoCriarPessoa,
} from "@/lib/admin/pessoas.functions";
import { assertModuloPermitido } from "@/lib/route-guards";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";

export const Route = createFileRoute("/_authenticated/admin/pessoas")({
  head: () => ({ meta: [{ title: "Pessoas e permissões — Configurações gerais — Agilliza" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: "pessoas" | "regras" | "tipos" } => ({
    tab: search.tab === "regras" ? "regras" : search.tab === "tipos" ? "tipos" : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("admin.pessoas"),
  component: PessoasPage,
});

const ROTULO_PAPEL: Record<string, string> = {
  gestor: "Gestão",
  correspondente: "Correspondente",
  comercial: "Comercial",
  analista: "Analista",
  imobiliaria: "Imobiliária",
  corretor: "Corretor",
  admin: "Admin",
  cliente: "Cliente",
};

const ROTULO_TIPO: Record<string, string> = {
  usuario: "Usuário",
  imobiliaria: "Imobiliária",
  corretor: "Corretor",
};

/** Situação de acesso da pessoa: sem login, ativa ou bloqueada. */
function StatusPessoa({ p, ativo }: { p: PessoaLista; ativo: boolean }) {
  if (!p.login_habilitado) return <Selo>Sem login</Selo>;
  return ativo ? (
    <Selo tom="sucesso" ponto>
      Ativo
    </Selo>
  ) : (
    <Selo tom="perigo">Bloqueado</Selo>
  );
}

function PessoasPage() {
  const { tab } = Route.useSearch();
  const [aba, setAba] = useState<"pessoas" | "regras" | "tipos">(tab ?? "pessoas");
  const [filtro, setFiltro] = useState<"todos" | "sistema" | "portal_parceiro">("todos");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [credenciais, setCredenciais] = useState<ResultadoCriarPessoa | null>(null);
  const [editando, setEditando] = useState<PessoaLista | null>(null);
  const [excluindo, setExcluindo] = useState<PessoaLista | null>(null);
  const [habilitando, setHabilitando] = useState<PessoaLista | null>(null);
  const [habilitarEmail, setHabilitarEmail] = useState("");

  const qc = useQueryClient();
  const alternarStatusFn = useServerFn(alternarStatusPessoa);
  const resetarSenhaFn = useServerFn(resetarSenhaPessoa);
  const excluirFn = useServerFn(excluirPessoa);
  const habilitarLoginFn = useServerFn(habilitarLoginPessoa);

  const sessaoQuery = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
  });

  const pessoasQuery = useQuery({
    queryKey: ["pessoas"],
    queryFn: () => listarPessoas(),
  });

  const tiposQuery = useQuery({
    queryKey: ["tipos-pessoa"],
    queryFn: () => listarTiposPessoa(),
  });
  const rotuloTipo = (slug: string) =>
    (tiposQuery.data ?? []).find((t) => t.slug === slug)?.nome ?? ROTULO_TIPO[slug] ?? "Usuário";

  const statusMut = useMutation({
    mutationFn: (v: { id: string; ativar: boolean }) => alternarStatusFn({ data: v }),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success(v.ativar ? "Pessoa ativada." : "Pessoa desativada.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e, "Não foi possível concluir a operação.")),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => resetarSenhaFn({ data: { id } }),
    onSuccess: (res) => setCredenciais(res),
    onError: (e: Error) => toast.error(mensagemDeErro(e, "Não foi possível concluir a operação.")),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa excluída.");
      setExcluindo(null);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e, "Não foi possível concluir a operação.")),
  });

  const habilitarMut = useMutation({
    mutationFn: (v: { id: string; email: string }) => habilitarLoginFn({ data: v }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      setHabilitando(null);
      setHabilitarEmail("");
      setCredenciais(res);
      toast.success("Login habilitado.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e, "Não foi possível concluir a operação.")),
  });

  const podeGerenciar = sessaoQuery.data?.podeGerenciarPessoas ?? false;
  // As ações da linha exigem também "Pessoas: editar" no servidor; sem isso o menu
  // aparecia e cada clique dava "sem permissão".
  const podeEditarPessoas = usePermissao("admin.pessoas", "edit");
  const meuId = sessaoQuery.data?.profile?.id ?? null;

  const pessoas = (pessoasQuery.data ?? [])
    .filter((p) => (filtro === "todos" ? true : p.acesso_tipo === filtro))
    .filter((p) =>
      busca
        ? [p.nome, p.email].some((v) => (v ?? "").toLowerCase().includes(busca.toLowerCase()))
        : true,
    );

  const todas = pessoasQuery.data ?? [];
  const totalAtivos = todas.filter((p) => p.login_habilitado && p.ativo && !p.bloqueado_em).length;
  const totalSemLogin = todas.filter((p) => !p.login_habilitado).length;
  const totalParceiros = todas.filter((p) => p.acesso_tipo === "portal_parceiro").length;
  const totalInternos = todas.filter((p) => p.acesso_tipo === "sistema").length;

  return (
    <>
      <PaginaGestao>
        <CabecalhoGestao
          secao="Configurações gerais"
          icone={<Users />}
          titulo="Pessoas e permissões"
          descricao="Equipe interna e parceiros, os papéis de acesso e a matriz de permissões organizada como o menu."
          acoes={
            aba === "pessoas" && podeGerenciar && !criando ? (
              <Button className="min-h-11 sm:min-h-9" onClick={() => setCriando(true)}>
                <Plus className="mr-1.5 size-4" /> Nova pessoa
              </Button>
            ) : undefined
          }
        />
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="pessoas" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
              <Users className="size-4" /> Pessoas
            </TabsTrigger>
            <TabsTrigger value="regras" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
              <ShieldCheck className="size-4" /> Papéis e permissões
            </TabsTrigger>
            <TabsTrigger value="tipos" className="min-h-11 flex-1 gap-1.5 sm:min-h-8 sm:flex-none">
              <Tags className="size-4" /> Tipos de pessoa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas" className="mt-5 space-y-5">
            <FaixaIndicadores>
              <Indicador
                icone={<Users />}
                rotulo="Pessoas"
                valor={todas.length}
                detalhe={`${totalInternos} da equipe interna`}
                carregando={pessoasQuery.isLoading}
                onClick={() => setFiltro("todos")}
                ativo={filtro === "todos"}
              />
              <Indicador
                icone={<CheckCircle2 />}
                tom="sucesso"
                rotulo="Com acesso ativo"
                valor={totalAtivos}
                detalhe="entram no sistema"
                carregando={pessoasQuery.isLoading}
              />
              <Indicador
                icone={<Handshake />}
                rotulo="Parceiros"
                valor={totalParceiros}
                detalhe="Portal do Parceiro"
                carregando={pessoasQuery.isLoading}
                onClick={() => setFiltro("portal_parceiro")}
                ativo={filtro === "portal_parceiro"}
              />
              <Indicador
                icone={<Ban />}
                tom="neutro"
                rotulo="Sem login"
                valor={totalSemLogin}
                detalhe="cadastro sem acesso"
                carregando={pessoasQuery.isLoading}
              />
            </FaixaIndicadores>

            {criando && (
              <NovaPessoaInline
                onCancel={() => setCriando(false)}
                onAbrirPermissoes={() => {
                  setCriando(false);
                  setAba("regras");
                }}
                onCreated={(res) => {
                  setCriando(false);
                  // Sem login não há senha: o modal abria com o campo vazio.
                  if (res.senha_temporaria) {
                    setCredenciais(res);
                    toast.success("Pessoa criada com sucesso.");
                  } else {
                    toast.success("Pessoa cadastrada sem acesso ao sistema.");
                  }
                }}
              />
            )}

            <BarraFiltros className="md:justify-between">
              <ChipsFiltro<"todos" | "sistema" | "portal_parceiro">
                rotulo="Quem mostrar"
                valor={filtro}
                onChange={setFiltro}
                opcoes={[
                  { valor: "todos", rotulo: "Todos", contagem: todas.length },
                  { valor: "sistema", rotulo: "Equipe interna", contagem: totalInternos },
                  { valor: "portal_parceiro", rotulo: "Parceiros", contagem: totalParceiros },
                ]}
              />
              <CampoBusca
                valor={busca}
                onChange={setBusca}
                rotulo="Buscar pessoa"
                placeholder="Buscar por nome ou e-mail"
              />
            </BarraFiltros>

            <Secao semRespiro>
              {pessoasQuery.isError ? (
                <EstadoErro
                  mensagem={mensagemDeErro(pessoasQuery.error, "Não foi possível carregar as pessoas.")}
                  onTentar={() => pessoasQuery.refetch()}
                />
              ) : pessoasQuery.isLoading ? (
                <ListaCarregando linhas={5} />
              ) : pessoas.length === 0 ? (
                <EstadoVazio
                  icone={<Users />}
                  titulo={busca || filtro !== "todos" ? "Ninguém com estes filtros" : "Nenhuma pessoa cadastrada"}
                  descricao={
                    busca || filtro !== "todos"
                      ? "Limpe a busca ou escolha outro grupo."
                      : "Cadastre a equipe interna e os parceiros para dar acesso ao sistema."
                  }
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {pessoas.map((p: any) => {
                    const ativo = p.ativo && !p.bloqueado_em;
                    // O próprio cadastro não se altera por aqui (o servidor recusa).
                    const gerenciavel =
                      podeEditarPessoas &&
                      p.id !== meuId &&
                      !p.roles.includes("correspondente") &&
                      !p.roles.includes("admin");
                    return (
                      <li
                        key={p.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto]"
                      >
                        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.nome ?? ""}
                              loading="lazy"
                              decoding="async"
                              className="size-full object-cover"
                            />
                          ) : (
                            <Avatar nome={p.nome} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{p.nome ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.email ?? "Sem e-mail"}</p>
                          <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                            <StatusPessoa p={p} ativo={ativo} />
                            <span className="truncate text-xs text-muted-foreground">
                              {p.nivel_acesso_nome ??
                                (p.roles.map((r: string) => ROTULO_PAPEL[r] ?? r).join(", ") || "—")}
                            </span>
                          </div>
                        </div>
                        <div className="hidden min-w-0 md:block">
                          <div className="flex flex-wrap gap-1">
                            {(p.tipos_pessoa?.length ? p.tipos_pessoa : [p.tipo_pessoa]).map(
                              (slug: string) => (
                                <Selo key={slug}>{rotuloTipo(slug)}</Selo>
                              ),
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {p.nivel_acesso_nome ??
                              (p.roles.map((r: string) => ROTULO_PAPEL[r] ?? r).join(", ") || "—")}
                            {p.telefone ? ` · ${p.telefone}` : ""}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <StatusPessoa p={p} ativo={ativo} />
                        </div>
                        <div className="flex justify-end">
                          {podeGerenciar && gerenciavel && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-11 sm:size-8">
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Ações de {p.nome ?? "pessoa"}</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditando(p)}>
                                  <Pencil className="mr-2 size-4" /> Editar e-mail / dados
                                </DropdownMenuItem>
                                {p.login_habilitado ? (
                                  <>
                                    <DropdownMenuItem onClick={() => resetMut.mutate(p.id)}>
                                      <KeyRound className="mr-2 size-4" /> Redefinir senha
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className={ativo ? "text-destructive" : "text-success-texto"}
                                      onClick={() => statusMut.mutate({ id: p.id, ativar: !ativo })}
                                    >
                                      <ShieldAlert className="mr-2 size-4" />
                                      {ativo ? "Bloquear acesso" : "Desbloquear acesso"}
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setHabilitando(p);
                                      setHabilitarEmail(p.email ?? "");
                                    }}
                                  >
                                    <LogIn className="mr-2 size-4" /> Habilitar login
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setExcluindo(p)}
                                >
                                  <Trash2 className="mr-2 size-4" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Secao>
          </TabsContent>

          <TabsContent value="regras" className="mt-5">
            <RegrasModulosPanel />
          </TabsContent>

          <TabsContent value="tipos" className="mt-5">
            <TiposPessoaPanel podeGerenciar={podeGerenciar} />
          </TabsContent>
        </Tabs>
      </PaginaGestao>

      {/* Modal: senha temporária */}
      <Dialog open={!!credenciais} onOpenChange={(o) => !o && setCredenciais(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso criado</DialogTitle>
            <DialogDescription>
              A senha provisória é o próprio e-mail. No primeiro acesso a pessoa define a senha
              dela antes de usar o sistema.
            </DialogDescription>
          </DialogHeader>
          {credenciais && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input readOnly value={credenciais.email} />
              </div>
              <div className="space-y-1">
                <Label>Senha provisória</Label>
                <div className="flex gap-2">
                  <Input readOnly value={credenciais.senha_temporaria} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copiar senha provisória"
                    onClick={() => {
                      navigator.clipboard.writeText(credenciais.senha_temporaria);
                      toast.success("Senha copiada.");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredenciais(null)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: habilitar login */}
      <Dialog
        open={!!habilitando}
        onOpenChange={(o) => {
          if (!o) {
            setHabilitando(null);
            setHabilitarEmail("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Habilitar login</DialogTitle>
            <DialogDescription>
              Informe o e-mail de acesso de {habilitando?.nome ?? "esta pessoa"}. A senha
              provisória será o próprio e-mail, trocada no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hab-email">E-mail</Label>
            <Input
              id="hab-email"
              type="email"
              value={habilitarEmail}
              onChange={(e) => setHabilitarEmail(e.target.value)}
              placeholder="nome@empresa.com"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHabilitando(null);
                setHabilitarEmail("");
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={habilitarMut.isPending || !habilitarEmail.trim()}
              onClick={() =>
                habilitando &&
                habilitarMut.mutate({ id: habilitando.id, email: habilitarEmail.trim() })
              }
            >
              Habilitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar pessoa */}
      <EditarPessoaDialog pessoa={editando} onClose={() => setEditando(null)} />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.nome ?? "Esta pessoa"} perderá o acesso ao sistema definitivamente. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluindo && excluirMut.mutate(excluindo.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
