import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Pencil, Trash2, Tag, LogIn } from "lucide-react";
import { toast } from "sonner";
import {
  listarTiposPessoa,
  criarTipoPessoa,
  atualizarTipoPessoa,
  excluirTipoPessoa,
  type AcessoTipo,
  type TipoPessoaItem,
} from "@/lib/admin/tipos-pessoa.functions";
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
  Dialog,
  DialogContent,
  DialogDescription,
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

const ACESSO_LABEL: Record<AcessoTipo, string> = {
  sistema: "Interno (Correspondente)",
  portal_parceiro: "Parceiro",
};

interface FormState {
  id?: string;
  nome: string;
  descricao: string;
  acesso_tipo: AcessoTipo;
  login_padrao: boolean;
  ativo: boolean;
}

const FORM_VAZIO: FormState = {
  nome: "",
  descricao: "",
  acesso_tipo: "sistema",
  login_padrao: true,
  ativo: true,
};

export function TiposPessoaPanel({ podeGerenciar }: { podeGerenciar: boolean }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarTiposPessoa);
  const criar = useServerFn(criarTipoPessoa);
  const atualizar = useServerFn(atualizarTipoPessoa);
  const excluir = useServerFn(excluirTipoPessoa);

  const { data: tipos, isLoading } = useQuery({
    queryKey: ["tipos-pessoa"],
    queryFn: () => listar(),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [excluindo, setExcluindo] = useState<TipoPessoaItem | null>(null);

  const salvarMut = useMutation({
    mutationFn: (v: FormState) =>
      v.id
        ? atualizar({
            data: {
              id: v.id,
              nome: v.nome,
              descricao: v.descricao || null,
              acesso_tipo: v.acesso_tipo,
              login_padrao: v.login_padrao,
              ativo: v.ativo,
            },
          })
        : criar({
            data: {
              nome: v.nome,
              descricao: v.descricao || null,
              acesso_tipo: v.acesso_tipo,
              login_padrao: v.login_padrao,
              ativo: v.ativo,
            },
          }),
    onSuccess: async () => {
      toast.success(form?.id ? "Tipo atualizado." : "Tipo criado.");
      setForm(null);
      await qc.invalidateQueries({ queryKey: ["tipos-pessoa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: async () => {
      toast.success("Tipo excluído.");
      setExcluindo(null);
      await qc.invalidateQueries({ queryKey: ["tipos-pessoa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">Tipos de Pessoa</h2>
          <p className="text-sm text-muted-foreground">
            Os tipos que marcam cada usuário e definem por qual portal ele acessa.
          </p>
        </div>
        {podeGerenciar ? (
          <Button onClick={() => setForm({ ...FORM_VAZIO })}>
            <Plus className="h-4 w-4" /> Novo tipo
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (tipos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(tipos ?? []).map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-2">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{t.nome}</span>
                    {t.is_padrao ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Padrão
                      </Badge>
                    ) : null}
                    {!t.ativo ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Inativo
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{ACESSO_LABEL[t.acesso_tipo]}</p>
                  {t.descricao ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t.descricao}</p>
                  ) : null}
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <LogIn className="h-3 w-3" />
                    Login padrão: {t.login_padrao ? "Sim" : "Não"} · {t.pessoas_vinculadas} pessoa(s)
                  </p>
                </div>
              </div>
              {podeGerenciar ? (
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: t.id,
                        nome: t.nome,
                        descricao: t.descricao ?? "",
                        acesso_tipo: t.acesso_tipo,
                        login_padrao: t.login_padrao,
                        ativo: t.ativo,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setExcluindo(t)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar tipo de pessoa" : "Novo tipo de pessoa"}</DialogTitle>
            <DialogDescription>
              Defina o nome, por qual portal a pessoa acessa e se, por padrão, ela tem login.
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tp-nome">Nome</Label>
                <Input
                  id="tp-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Corretor parceiro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tp-desc">Descrição</Label>
                <Input
                  id="tp-desc"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de acesso</Label>
                <Select
                  value={form.acesso_tipo}
                  onValueChange={(v) => setForm({ ...form, acesso_tipo: v as AcessoTipo })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sistema">Interno (Correspondente)</SelectItem>
                    <SelectItem value="portal_parceiro">Parceiro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Parceiro acessa pelo portal do parceiro; Interno acessa pelo portal do
                  correspondente.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Login por padrão</p>
                  <p className="text-xs text-muted-foreground">
                    Sugere ter acesso ao sistema ao cadastrar pessoas deste tipo.
                  </p>
                </div>
                <Switch
                  checked={form.login_padrao}
                  onCheckedChange={(v) => setForm({ ...form, login_padrao: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Tipos inativos não aparecem ao cadastrar novas pessoas.
                  </p>
                </div>
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => form && salvarMut.mutate(form)}
              disabled={!form || form.nome.trim().length < 2 || salvarMut.isPending}
            >
              {salvarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={excluindo !== null} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove o tipo “{excluindo?.nome}”. Não é possível excluir se houver pessoas
              vinculadas a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (excluindo) excluirMut.mutate(excluindo.id);
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
