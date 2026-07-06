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

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  useEffect(() => {
    if (pessoa) {
      setNome(pessoa.nome ?? "");
      setTelefone(pessoa.telefone ?? "");
      setNivelId(pessoa.nivel_acesso_id ?? "");
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
    if (!nivelId) return toast.error("Selecione um nível de acesso.");
    salvar.mutate();
  }

  return (
    <Dialog open={!!pessoa} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar pessoa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submeter} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ep-nome">Nome completo</Label>
            <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
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
