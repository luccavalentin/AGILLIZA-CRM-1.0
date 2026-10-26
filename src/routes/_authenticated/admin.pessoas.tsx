import { AdminHero } from "@/components/admin/admin-hero";
import { SenhasProvisoriasAntigas } from "@/components/admin/senhas-provisorias-antigas";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  MailCheck,
  TriangleAlert,
  Search,
  MoreHorizontal,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  LogIn,
  Users,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  head: () => ({ meta: [{ title: "Pessoas do meu ecossistema — Agilliza" }] }),
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

function PessoasPage() {
  const { tab } = Route.useSearch();
  const [aba, setAba] = useState<"pessoas" | "regras" | "tipos">(tab ?? "pessoas");
  const [filtro, setFiltro] = useState<"todos" | "sistema" | "portal_parceiro">("todos");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  // Resultado de criar / redefinir senha / habilitar login: a senha provisória vai só
  // para o e-mail da pessoa e nunca aparece aqui (decisão 15 do backtest de 23/10/2026).
  const [envio, setEnvio] = useState<{ titulo: string; res: ResultadoCriarPessoa } | null>(null);
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
    onSuccess: (res) => setEnvio({ titulo: "Senha redefinida", res }),
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
      setEnvio({ titulo: "Login habilitado", res });
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

  return (
    <>
      <div className="mx-auto max-w-none space-y-6">
        <AdminHero
          icon={<Users className="h-5 w-5" />}
          titulo="Pessoas & Permissões de Acessos"
          descricao="Gerenciamento de equipe interna, parceiros, níveis de acesso e foto de perfil."
        />
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="mb-6 h-auto max-w-full flex-wrap justify-start">
            <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
            <TabsTrigger value="regras">Papéis & Permissões</TabsTrigger>
            <TabsTrigger value="tipos">Tipos de Pessoa</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Pessoas do meu ecossistema
                </h2>
                <p className="text-sm text-muted-foreground">
                  Equipe interna e parceiros em uma única lista.
                </p>
              </div>
              {podeGerenciar && !criando && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {/* Só administrador e correspondente (o servidor confere de novo). */}
                  {(sessaoQuery.data?.roles ?? []).some(
                    (r) => r === "admin" || r === "correspondente",
                  ) && <SenhasProvisoriasAntigas />}
                  <Button onClick={() => setCriando(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nova pessoa
                  </Button>
                </div>
              )}
            </div>

            {criando && (
              <div className="mt-6">
                <NovaPessoaInline
                  onCancel={() => setCriando(false)}
                  onAbrirPermissoes={() => {
                    setCriando(false);
                    setAba("regras");
                  }}
                  onCreated={(res) => {
                    setCriando(false);
                    // Sem login não há senha nem e-mail para avisar.
                    if (res.email) {
                      setEnvio({ titulo: "Acesso criado", res });
                      toast.success("Pessoa criada com sucesso.");
                    } else {
                      toast.success("Pessoa cadastrada sem acesso ao sistema.");
                    }
                  }}
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
                <TabsList className="h-auto max-w-full flex-wrap justify-start">
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="sistema">Equipe interna</TabsTrigger>
                  <TabsTrigger value="portal_parceiro">Parceiros</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail"
                  className="pl-9"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border bg-background">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Tipo / Nível</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    {podeGerenciar && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pessoasQuery.isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={podeGerenciar ? 5 : 4}
                        className="py-10 text-center text-muted-foreground"
                      >
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        <span className="mt-2 block text-xs">Carregando…</span>
                      </TableCell>
                    </TableRow>
                  ) : pessoas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={podeGerenciar ? 5 : 4}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhuma pessoa encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pessoas.map((p: any) => {
                      const ativo = p.ativo && !p.bloqueado_em;
                      // O próprio cadastro não se altera por aqui (o servidor recusa).
                      const gerenciavel =
                        podeEditarPessoas &&
                        p.id !== meuId &&
                        !p.roles.includes("correspondente") &&
                        !p.roles.includes("admin");
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted shadow-inner ring-1 ring-border">
                                {p.avatar_url ? (
                                  <img
                                    src={p.avatar_url}
                                    alt={p.nome ?? ""}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                                    <Users className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{p.nome ?? "—"}</span>
                                <span className="text-xs text-muted-foreground">
                                  {p.email ?? "Sem e-mail"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap gap-1">
                                {(p.tipos_pessoa?.length ? p.tipos_pessoa : [p.tipo_pessoa]).map(
                                  (slug: string) => (
                                    <Badge
                                      key={slug}
                                      variant="secondary"
                                      className="px-1.5 py-0 text-[10px] font-medium uppercase tracking-wider"
                                    >
                                      {rotuloTipo(slug)}
                                    </Badge>
                                  ),
                                )}
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {p.nivel_acesso_nome ??
                                  (p.roles.map((r: string) => ROTULO_PAPEL[r] ?? r).join(", ") ||
                                    "—")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {p.telefone ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {!p.login_habilitado ? (
                              <Badge
                                variant="outline"
                                className="h-5 border-dashed px-2 font-normal opacity-60"
                              >
                                Sem login
                              </Badge>
                            ) : (
                              <Badge
                                variant={ativo ? "success" : "destructive"}
                                className={
                                  ativo
                                    ? "h-5 gap-1 bg-emerald-500/10 px-2 font-normal text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                    : "h-5 px-2 font-normal"
                                }
                              >
                                {ativo && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                )}
                                {ativo ? "Ativo" : "Bloqueado"}
                              </Badge>
                            )}
                          </TableCell>
                          {podeGerenciar && (
                            <TableCell className="text-right">
                              {gerenciavel && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Ações</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditando(p)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Editar e-mail / dados
                                    </DropdownMenuItem>
                                    {p.login_habilitado ? (
                                      <>
                                        <DropdownMenuItem onClick={() => resetMut.mutate(p.id)}>
                                          <KeyRound className="mr-2 h-4 w-4" /> Redefinir senha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className={
                                            ativo ? "text-destructive" : "text-emerald-600"
                                          }
                                          onClick={() =>
                                            statusMut.mutate({ id: p.id, ativar: !ativo })
                                          }
                                        >
                                          <ShieldAlert className="mr-2 h-4 w-4" />
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
                                        <LogIn className="mr-2 h-4 w-4" /> Habilitar login
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setExcluindo(p)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="regras">
            <RegrasModulosPanel />
          </TabsContent>

          <TabsContent value="tipos">
            <TiposPessoaPanel podeGerenciar={podeGerenciar} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: senha provisória enviada por e-mail (a senha não aparece aqui) */}
      <Dialog open={!!envio} onOpenChange={(o) => !o && setEnvio(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{envio?.titulo ?? "Acesso"}</DialogTitle>
            <DialogDescription>
              A senha provisória é sorteada pelo sistema e vai só para o e-mail da pessoa: ninguém
              mais a vê. No primeiro acesso ela define uma senha própria.
            </DialogDescription>
          </DialogHeader>
          {envio &&
            (envio.res.senha_enviada ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="min-w-0 text-foreground">
                  Senha provisória enviada para{" "}
                  <span className="break-all font-medium">{envio.res.email}</span>. Se não chegar em
                  alguns minutos, peça para conferir o spam ou use “Redefinir senha” para enviar
                  outra.
                </p>
              </div>
            ) : (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="min-w-0 text-foreground">
                  {envio.res.aviso_envio ??
                    "Não foi possível enviar a senha por e-mail. Use “Redefinir senha” para enviar outra."}
                </p>
              </div>
            ))}
          <DialogFooter>
            <Button onClick={() => setEnvio(null)}>Concluído</Button>
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
              Informe o e-mail de acesso de {habilitando?.nome ?? "esta pessoa"}. O sistema sorteia
              uma senha provisória e a envia só para este e-mail; no primeiro acesso a pessoa define
              a dela.
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
