import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { listarNiveisAcesso } from "@/lib/admin/regras-modulos.functions";
import { atualizarPessoa, type PessoaLista } from "@/lib/admin/pessoas.functions";
import { listarTiposPessoa } from "@/lib/admin/tipos-pessoa.functions";
import { PermissoesResumo } from "@/components/admin/permissoes-resumo";

export function EditarPessoaDialog({
  pessoa,
  onClose,
}: {
  pessoa: PessoaLista | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const atualizar = useServerFn(atualizarPessoa);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nivelId, setNivelId] = useState("");
  const [tiposPessoa, setTiposPessoa] = useState<string[]>(["usuario"]);

  const listarTipos = useServerFn(listarTiposPessoa);
  const { data: tipos } = useQuery({
    queryKey: ["tipos-pessoa"],
    queryFn: () => listarTipos(),
  });

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  useEffect(() => {
    if (pessoa) {
      setNome(pessoa.nome ?? "");
      setTelefone(pessoa.telefone ?? "");
      setNivelId(pessoa.nivel_acesso_id ?? "");
      const tps = (pessoa.tipos_pessoa ?? []).filter(Boolean);
      setTiposPessoa(tps.length > 0 ? tps : [pessoa.tipo_pessoa ?? "usuario"]);
    }
  }, [pessoa]);

  const salvar = useMutation({
    mutationFn: () =>
      atualizar({
        data: {
          id: pessoa!.id,
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          nivel_acesso_id: nivelId,
          tipos_pessoa: tiposPessoa,
          tipo_pessoa: tiposPessoa[0],
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Pessoa atualizada.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) return toast.error("Informe o nome completo.");
    if (tiposPessoa.length === 0) return toast.error("Selecione ao menos um tipo de pessoa.");
    if (!nivelId) return toast.error("Selecione um nível de acesso.");
    salvar.mutate();
  }

  const nivelSelecionado = (niveis ?? []).find((n) => n.id === nivelId);

  return (
    <Dialog open={!!pessoa} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar pessoa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ep-nome">Nome completo</Label>
            <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} required />
          </div>
          <div className="space-y-2">
            <Label>Tipos de pessoa</Label>
            <p className="text-xs text-muted-foreground">
              Selecione um ou mais. Os privilégios somam o acesso mais amplo.
            </p>
            <div className="flex flex-wrap gap-2">
              {(tipos ?? [])
                .filter((t) => t.ativo || tiposPessoa.includes(t.slug))
                .map((t) => {
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
                          return [...prev, t.slug];
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-email">E-mail</Label>
            <Input id="ep-email" value={pessoa?.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-tel">Telefone</Label>
            <Input id="ep-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
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
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
