import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RegrasModulosPanel } from "@/components/admin/regras-modulos-panel";
import { getMinhaSessao } from "@/lib/session.functions";
import {
  listarPessoas,
  criarPessoaComAcesso,
  type ResultadoCriarPessoa,
  type CriarPessoaInput,
} from "@/lib/admin/pessoas.functions";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/pessoas")({
  head: () => ({ meta: [{ title: "Pessoas do meu ecossistema — Agilliza" }] }),
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

function PessoasPage() {
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<"pessoas" | "regras">("pessoas");
  const [filtro, setFiltro] = useState<"todos" | "sistema" | "portal_parceiro">("todos");
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [portalParceiro, setPortalParceiro] = useState(false);
  const [papel, setPapel] = useState<string>("comercial");
  const [credenciais, setCredenciais] = useState<ResultadoCriarPessoa | null>(null);

  const sessaoQuery = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
  });

  const pessoasQuery = useQuery({
    queryKey: ["pessoas"],
    queryFn: () => listarPessoas(),
  });

  const criar = useMutation({
    mutationFn: (payload: CriarPessoaInput) => criarPessoaComAcesso({ data: payload }),
    onSuccess: (res) => {
      setCredenciais(res);
      setDialogAberto(false);
      queryClient.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa criada com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });


  function abrirNova() {
    setPortalParceiro(false);
    setPapel("comercial");
    setDialogAberto(true);
  }

  function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    criar.mutate({
      nome: String(form.get("nome")),
      email: String(form.get("email")),
      telefone: String(form.get("telefone") || ""),
      acesso_tipo: portalParceiro ? "portal_parceiro" : "sistema",
      papel: papel as never,
      dados_parceiro: portalParceiro
        ? {
            creci: String(form.get("creci") || ""),
            comissao_padrao: Number(form.get("comissao") || 0),
          }
        : undefined,
    });
  }

  const podeGerenciar = sessaoQuery.data?.podeGerenciarPessoas ?? false;

  const pessoas = (pessoasQuery.data ?? [])
    .filter((p) => (filtro === "todos" ? true : p.acesso_tipo === filtro))
    .filter((p) =>
      busca
        ? [p.nome, p.email].some((v) =>
            (v ?? "").toLowerCase().includes(busca.toLowerCase()),
          )
        : true,
    );

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="mb-6">
            <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
            <TabsTrigger value="regras">Regras & Módulos</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Pessoas do meu ecossistema
                </h1>
                <p className="text-sm text-muted-foreground">
                  Equipe interna e parceiros em uma única lista.
                </p>
              </div>
              {podeGerenciar && (
                <Button onClick={abrirNova}>
                  <Plus className="mr-2 h-4 w-4" /> Nova pessoa
                </Button>
              )}
            </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="sistema">Sistema</TabsTrigger>
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

        <div className="mt-4 rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pessoasQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Carregando…
                  </TableCell>
                </TableRow>
              ) : pessoas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhuma pessoa cadastrada ainda. Use “Nova pessoa” para começar.
                  </TableCell>
                </TableRow>
              ) : (
                pessoas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                    <TableCell>
                      {p.roles.map((r) => ROTULO_PAPEL[r] ?? r).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.acesso_tipo === "portal_parceiro" ? "secondary" : "outline"}>
                        {p.acesso_tipo === "portal_parceiro" ? "Portal do Parceiro" : "Sistema"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.ativo && !p.bloqueado_em ? "default" : "destructive"}>
                        {p.ativo && !p.bloqueado_em ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          </TabsContent>

          <TabsContent value="regras">
            <RegrasModulosPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: nova pessoa */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submeter}>
            <DialogHeader>
              <DialogTitle>Nova pessoa</DialogTitle>
              <DialogDescription>
                Cadastre um membro da equipe ou um parceiro do seu ecossistema.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np-nome">Nome completo</Label>
                <Input id="np-nome" name="nome" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-email">E-mail</Label>
                <Input id="np-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np-tel">Telefone</Label>
                <Input id="np-tel" name="telefone" type="tel" />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Acesso ao Portal do Parceiro</p>
                  <p className="text-xs text-muted-foreground">
                    Ligado: entra por /parceiro. Desligado: usuário interno.
                  </p>
                </div>
                <Switch
                  checked={portalParceiro}
                  onCheckedChange={(v) => {
                    setPortalParceiro(v);
                    setPapel(v ? "corretor" : "comercial");
                  }}
                />
              </div>

              {portalParceiro ? (
                <>
                  <div className="space-y-2">
                    <Label>Tipo de parceiro</Label>
                    <Select value={papel} onValueChange={setPapel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                        <SelectItem value="corretor">Corretor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="np-creci">CRECI</Label>
                      <Input id="np-creci" name="creci" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="np-com">% comissão</Label>
                      <Input id="np-com" name="comissao" type="number" step="0.01" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Nível de acesso interno</Label>
                  <Select value={papel} onValueChange={setPapel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="analista">Analista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={criar.isPending}>
                {criar.isPending ? "Criando…" : "Criar pessoa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </>

  );
}
