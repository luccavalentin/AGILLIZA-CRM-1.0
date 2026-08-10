import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { listarNiveisAcesso } from "@/lib/admin/regras-modulos.functions";
import { criarPessoaComAcesso } from "@/lib/admin/pessoas.functions";
import { validarEmail } from "@/lib/crm/documento";

/**
 * Diálogo para criar rapidamente uma pessoa (imobiliária, corretor ou comercial)
 * sem sair da tela do cliente/proposta. Ao concluir, retorna o id criado para
 * ser vinculado e o fluxo continua normalmente.
 */
export function CriarVinculoInline({
  aberto,
  onOpenChange,
  tipoPessoa,
  rotuloTipo,
  onCriado,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  tipoPessoa: string;
  rotuloTipo: string;
  onCriado: (id: string) => void;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarNiveisAcesso);
  const criar = useServerFn(criarPessoaComAcesso);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [comLogin, setComLogin] = useState(false);
  const [nivelId, setNivelId] = useState("");
  const [credenciais, setCredenciais] = useState<{ email: string; senha: string; idCriado: string } | null>(null);

  const { data: niveis } = useQuery({
    queryKey: ["niveis-acesso"],
    queryFn: () => listar(),
    enabled: aberto,
  });

  // Sugere um nível de acesso adequado ao tipo:
  //  - imobiliaria -> "Imobiliária Parceira"
  //  - corretor    -> "Corretor Parceiro"
  //  - comercial   -> "Comercial"
  // Cai para portal do parceiro / sistema quando não há correspondência direta.
  const nivelSugerido = useMemo(() => {
    const lista = niveis ?? [];
    if (lista.length === 0) return "";
    // 1) casamento direto pelo papel do nível com o tipo da pessoa.
    const porPapel = lista.find(
      (n) => (n as { papel?: string }).papel === tipoPessoa,
    );
    if (porPapel) return porPapel.id;
    // 2) fallback por portal (parceiros) ou sistema.
    const querParceiro = tipoPessoa === "imobiliaria" || tipoPessoa === "corretor";
    const preferido = lista.find((n) =>
      querParceiro ? n.acesso_tipo === "portal_parceiro" : n.acesso_tipo === "sistema",
    );
    return (preferido ?? lista[0]).id;
  }, [niveis, tipoPessoa]);

  if (nivelSugerido && !nivelId) setNivelId(nivelSugerido);

  const salvar = useMutation({
    mutationFn: () => {
      if (nome.trim().length < 2) throw new Error("Informe o nome completo.");
      if (comLogin && !validarEmail(email)) throw new Error("Informe um e-mail válido.");
      if (!nivelId) throw new Error("Selecione um nível de acesso.");
      return criar({
        data: {
          nome: nome.trim(),
          email: comLogin ? email.trim() : "",
          nivel_acesso_id: nivelId,
          tipo_pessoa: tipoPessoa,
          tipos_pessoa: [tipoPessoa],
          com_login: comLogin,
        },
      });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["parceiros-disponiveis"] });
      await qc.invalidateQueries({ queryKey: ["pessoas"] });
      if (comLogin && res.senha_temporaria) {
        // Não exibe a senha em toast (pode ser perdida): abre modal dedicado
        // que persiste até o admin copiar e confirmar.
        setCredenciais({ email: res.email || email.trim(), senha: res.senha_temporaria, idCriado: res.id });
      } else {
        toast.success("Cadastro criado e vinculado.");
        onCriado(res.id);
        limpar();
        onOpenChange(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function limpar() {
    setNome("");
    setEmail("");
    setComLogin(false);
    setNivelId("");
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) limpar();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cadastro — {rotuloTipo}</DialogTitle>
          <DialogDescription>
            Cadastre rapidamente sem sair da proposta. Ao salvar, o cadastro já fica
            vinculado e você continua o fluxo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cv-nome">Nome completo</Label>
            <Input
              id="cv-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              placeholder="Ex.: MARIA SILVA"
            />
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <Switch id="cv-login" checked={comLogin} onCheckedChange={setComLogin} />
            <Label htmlFor="cv-login" className="cursor-pointer text-sm font-normal">
              {comLogin
                ? "Com login (acessa o Portal do Parceiro)"
                : "Sem login (apenas para vincular; habilite depois)"}
            </Label>
          </div>

          {comLogin && (
            <div className="space-y-2">
              <Label htmlFor="cv-email">E-mail</Label>
              <Input
                id="cv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
              />
            </div>
          )}

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
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvar.isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar e vincular
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modal dedicado: senha temporária (persiste até o admin copiar) */}
      <Dialog
        open={!!credenciais}
        onOpenChange={(o) => {
          if (!o && credenciais) {
            const id = credenciais.idCriado;
            setCredenciais(null);
            onCriado(id);
            limpar();
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copiar senha temporária</DialogTitle>
            <DialogDescription>
              Esta senha não será exibida novamente — copie e repasse por canal seguro.
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
                  <Input readOnly value={credenciais.senha} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      void navigator.clipboard.writeText(credenciais.senha);
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
            <Button
              onClick={() => {
                if (!credenciais) return;
                const id = credenciais.idCriado;
                setCredenciais(null);
                onCriado(id);
                limpar();
                onOpenChange(false);
              }}
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
