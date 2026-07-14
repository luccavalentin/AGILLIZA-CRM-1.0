import { AdminHero } from "@/components/admin/admin-hero";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Copy, Search, MoreHorizontal, Pencil, KeyRound, Ban, CheckCircle2, Trash2, LogIn, Users } from "lucide-react";
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


export const Route = createFileRoute("/_authenticated/admin/pessoas")({
  head: () => ({ meta: [{ title: "Pessoas do meu ecossistema — Agilliza" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: "pessoas" | "regras" | "tipos" } => ({
    tab: search.tab === "regras" ? "regras" : search.tab === "tipos" ? "tipos" : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("admin.pessoas"),
  component: PessoasPage,
});

const ROTULO_PAPEL: Record<string, string> = {
  correspondente: "Correspondente",
  gestor: "Gestor",
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
    (tiposQuery.data ?? []).find((t) => t.slug === slug)?.nome ??
    ROTULO_TIPO[slug] ??
    "Usuário";

  const statusMut = useMutation({
    mutationFn: (v: { id: string; ativar: boolean }) => alternarStatusFn({ data: v }),
    onSuccess: async (_r, v) => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success(v.ativar ? "Pessoa ativada." : "Pessoa desativada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => resetarSenhaFn({ data: { id } }),
    onSuccess: (res) => setCredenciais(res),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa excluída.");
      setExcluindo(null);
    },
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
  });

  const podeGerenciar = sessaoQuery.data?.podeGerenciarPessoas ?? false;




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
          titulo="Pessoas & Acessos"
          descricao="Equipe interna, parceiros, papéis e tipos de pessoa."
        />
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="mb-6">
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
                <Button onClick={() => setCriando(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nova pessoa
                </Button>
              )}
            </div>

            {criando && (
              <div className="mt-6">
                <NovaPessoaInline
                  onCancel={() => setCriando(false)}
                  onCreated={(res) => {
                    setCriando(false);
                    setCredenciais(res);
                    toast.success("Pessoa criada com sucesso.");
                  }}
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
                <TabsList>
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="sistema">Correspondente</TabsTrigger>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    {podeGerenciar && <TableHead className="w-12 text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pessoasQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Carregando…
                      </TableCell>
                    </TableRow>
                  ) : pessoas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nenhuma pessoa cadastrada ainda. Use “Nova pessoa” para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pessoas.map((p) => {
                      const ativo = p.ativo && !p.bloqueado_em;
                      const gerenciavel =
                        !p.roles.includes("correspondente") && !p.roles.includes("admin");
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{p.nome ?? "—"}</span>
                              {(p.tipos_pessoa?.length ? p.tipos_pessoa : [p.tipo_pessoa]).map(
                                (slug) => (
                                  <Badge key={slug} variant="outline" className="font-normal">
                                    {rotuloTipo(slug)}
                                  </Badge>
                                ),
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                          <TableCell>
                            {p.nivel_acesso_nome ??
                              (p.roles.map((r) => ROTULO_PAPEL[r] ?? r).join(", ") || "—")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                p.acesso_tipo === "portal_parceiro" ? "secondary" : "outline"
                              }
                            >
                              {p.acesso_tipo === "portal_parceiro"
                                ? "Portal do Parceiro"
                                : "Portal do Correspondente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!p.login_habilitado ? (
                              <Badge variant="secondary">Sem login</Badge>
                            ) : (
                              <Badge variant={ativo ? "default" : "destructive"}>
                                {ativo ? "Ativo" : "Inativo"}
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
                                      <Pencil className="mr-2 h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    {p.login_habilitado ? (
                                      <>
                                        <DropdownMenuItem onClick={() => resetMut.mutate(p.id)}>
                                          <KeyRound className="mr-2 h-4 w-4" /> Redefinir senha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            statusMut.mutate({ id: p.id, ativar: !ativo })
                                          }
                                        >
                                          {ativo ? (
                                            <>
                                              <Ban className="mr-2 h-4 w-4" /> Desativar
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle2 className="mr-2 h-4 w-4" /> Ativar
                                            </>
                                          )}
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

      {/* Modal: senha temporária */}
      <Dialog open={!!credenciais} onOpenChange={(o) => !o && setCredenciais(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar senha temporária</DialogTitle>
            <DialogDescription>
              Esta senha não será exibida novamente — repasse por canal seguro.
            </DialogDescription>
          </DialogHeader>
          {credenciais && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input readOnly value={credenciais.email} />
              </div>
              <div className="space-y-1">
                <Label>Senha temporária</Label>
                <div className="flex gap-2">
                  <Input readOnly value={credenciais.senha_temporaria} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
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
              Informe o e-mail de acesso de {habilitando?.nome ?? "esta pessoa"}. Uma senha
              provisória será gerada para o primeiro acesso.
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
