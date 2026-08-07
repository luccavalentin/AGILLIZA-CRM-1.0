import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, User, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadAvatar } from "./upload-avatar";
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
import { supabase } from "@/integrations/supabase/client";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pessoa) {
      setNome(pessoa.nome ?? "");
      setTelefone(pessoa.telefone ?? "");
      setNivelId(pessoa.nivel_acesso_id ?? "");
      setTiposPessoa(pessoa.tipos_pessoa ?? ["usuario"]);
      setAvatarUrl(pessoa.avatar_url ?? null);
    }
  }, [pessoa]);

  const listarTipos = useServerFn(listarTiposPessoa);
  const { data: tipos } = useQuery({
    queryKey: ["tipos-pessoa"],
    queryFn: () => listarTipos(),
  });

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
  });

  const mAtualizar = useMutation({
    mutationFn: async () => {
      if (!pessoa) return;
      return await atualizar({
        data: {
          id: pessoa.id,
          nome,
          telefone,
          nivel_acesso_id: nivelId,
          tipos_pessoa: tiposPessoa,
          avatar_url: avatarUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pessoa atualizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  if (!pessoa) return null;

  return (
    <Dialog open={!!pessoa} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-primary/20 bg-muted shadow-sm ring-2 ring-background">
              {avatarUrl ? (
                <img src={avatarUrl} alt={nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {nome || "Editar pessoa"}
              </DialogTitle>
              <span className="text-sm font-medium text-muted-foreground">{pessoa.email || "Sem e-mail cadastrado"}</span>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-1 py-4">
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-primary">Alterar foto de perfil</Label>
            <UploadAvatar
              currentUrl={avatarUrl}
              onUploadComplete={setAvatarUrl}
              userId={pessoa?.id}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-nome">Nome completo</Label>
            <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-nivel">Nível de acesso</Label>
            <Select value={nivelId} onValueChange={setNivelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um nível" />
              </SelectTrigger>
              <SelectContent>
                {(niveis ?? []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipos de pessoa</Label>
            <div className="flex flex-wrap gap-2">
              {(tipos ?? []).map((t) => {
                const ativo = tiposPessoa.includes(t.slug);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      setTiposPessoa((prev) =>
                        ativo ? prev.filter((p) => p !== t.slug) : [...prev, t.slug],
                      )
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
            <div className="flex gap-2">
              <Input
                id="ep-email"
                type="email"
                value={pessoa?.email ?? ""}
                readOnly
                disabled
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const targetEmail = prompt("Novo e-mail:", pessoa?.email ?? "");
                  if (targetEmail && targetEmail !== pessoa?.email) {
                    try {
                      // Usar client para atualizar e-mail via auth admin (necessita chave admin no client, ou API)
                      const { data: adminAuth, error: adminErr } = await supabase.auth.admin.updateUserById(
                        pessoa!.id,
                        { email: targetEmail }
                      );
                      if (adminErr) throw adminErr;
                      
                      // O e-mail de autenticação mudou, agora precisamos atualizar nosso profile
                      await supabase.from("profiles").update({ email: targetEmail }).eq("id", pessoa!.id);
                      
                      toast.success("E-mail atualizado. O usuário deve confirmar o link enviado.");
                      onClose();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }
                }}
              >
                Trocar
              </Button>
            </div>
          </div>
          <div className="space-y-2 pb-2">
            <Label htmlFor="ep-tel" className="text-sm font-semibold">Telefone</Label>
            <Input 
              id="ep-tel" 
              value={telefone} 
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="rounded-lg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mAtualizar.mutate()} disabled={mAtualizar.isPending}>
            {mAtualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}