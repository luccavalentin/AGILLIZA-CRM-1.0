import { useState, useEffect } from "react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { mascararTelefone, validarTelefone } from "@/lib/crm/documento";
import { Loader2, User } from "lucide-react";
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
import {
  alterarEmailPessoa,
  atualizarPessoa,
  type PessoaLista,
} from "@/lib/admin/pessoas.functions";
import { listarTiposPessoa } from "@/lib/admin/tipos-pessoa.functions";

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
  const alterarEmail = useServerFn(alterarEmailPessoa);
  /** null = e-mail só exibido; texto = campo liberado para troca. */
  const [novoEmail, setNovoEmail] = useState<string | null>(null);
  const [trocandoEmail, setTrocandoEmail] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nivelId, setNivelId] = useState("");
  const [tiposPessoa, setTiposPessoa] = useState<string[]>(["usuario"]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pessoa) {
      setNome(pessoa.nome ?? "");
      setTelefone(pessoa.telefone ? mascararTelefone(pessoa.telefone) : "");
      setNivelId(pessoa.nivel_acesso_id ?? "");
      setTiposPessoa(pessoa.tipos_pessoa ?? ["usuario"]);
      setAvatarUrl(pessoa.avatar_url ?? null);
    }
    // Sem isto, o e-mail digitado (e não salvo) aparecia no cadastro da próxima pessoa.
    setNovoEmail(null);
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
      if (telefone.trim() && !validarTelefone(telefone)) throw new Error("Telefone inválido.");
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
      toast.success("Pessoa atualizada.");
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      onClose();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar a pessoa.")),
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
              <span className="text-sm font-medium text-muted-foreground">
                {pessoa.email || "Sem e-mail cadastrado"}
              </span>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-1 py-4">
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-primary">
              Alterar foto de perfil
            </Label>
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
                value={novoEmail ?? pessoa?.email ?? ""}
                onChange={(e) => setNovoEmail(e.target.value)}
                disabled={novoEmail === null || trocandoEmail}
              />
              {novoEmail === null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoEmail(pessoa?.email ?? "")}
                >
                  Trocar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={trocandoEmail || !novoEmail.trim()}
                  onClick={async () => {
                    setTrocandoEmail(true);
                    try {
                      const r = await alterarEmail({ data: { id: pessoa!.id, email: novoEmail } });
                      if (r.aviso) toast.warning(r.aviso, { duration: 12_000 });
                      else
                        toast.success("E-mail de acesso atualizado.", {
                          description:
                            "O e-mail anterior (se havia) foi avisado e, por 72 horas, também recebe as senhas provisórias novas.",
                        });
                      setNovoEmail(null);
                      qc.invalidateQueries({ queryKey: ["pessoas"] });
                      onClose();
                    } catch (e) {
                      toast.error(mensagemDeErro(e, "Não foi possível trocar o e-mail."));
                    } finally {
                      setTrocandoEmail(false);
                    }
                  }}
                >
                  {trocandoEmail ? <Loader2 className="size-4 animate-spin" /> : "Salvar e-mail"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2 pb-2">
            <Label htmlFor="ep-tel" className="text-sm font-semibold">
              Telefone
            </Label>
            <Input
              id="ep-tel"
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              className="rounded-lg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mAtualizar.mutate()} disabled={mAtualizar.isPending}>
            {mAtualizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
