import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { concluirSenhaProvisoria } from "@/lib/conta/senha-provisoria.functions";
import { problemaDaSenhaNova } from "@/lib/auth/recuperacao";

/**
 * Senha nova depois do link de "Esqueci minha senha". Aparece no lugar das abas da tela de
 * login SÓ quando a pessoa volta pelo link (sessão aberta pelo e-mail). Ela não sabe a senha
 * atual, então não se pede: a sessão do link é a prova. Depois de trocar, todas as sessões
 * são encerradas (inclusive a do link) e ela entra de novo com a senha nova.
 */
export function NovaSenhaRecuperacao({ onConcluir }: { onConcluir: () => void }) {
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [email, setEmail] = useState("");
  const [provisoria, setProvisoria] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setEmail((u?.email ?? "").toLowerCase());
      setProvisoria(u?.app_metadata?.senha_provisoria === true);
    });
  }, []);

  const problema = nova.length > 0 ? problemaDaSenhaNova(nova, confirma, email) : null;
  // "As senhas não coincidem" só depois que a pessoa começou a confirmar.
  const aviso = problema === "As senhas não coincidem." && confirma.length === 0 ? null : problema;

  async function sairDeTodasAsSessoes() {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" });
  }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const erro = problemaDaSenhaNova(nova, confirma, email);
    if (erro) {
      toast.error(erro);
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) {
        const codigo = (error as { code?: string }).code;
        if (codigo === "same_password") {
          toast.error("A nova senha precisa ser diferente da anterior.");
        } else if (codigo === "weak_password") {
          toast.error("Senha fraca. Use pelo menos 8 caracteres, com letras e números.");
        } else {
          toast.error(
            "Não foi possível criar a senha. Peça um novo link em “Esqueci minha senha”.",
          );
        }
        return;
      }
      // Quem estava na senha provisória (sorteada) já escolheu a sua: a troca obrigatória acaba.
      if (provisoria) {
        await concluirSenhaProvisoria().catch(() => undefined);
      }
      await sairDeTodasAsSessoes();
      setNova("");
      setConfirma("");
      toast.success("Senha criada. Entre com o seu e-mail e a nova senha.");
      onConcluir();
    } catch {
      toast.error("Não foi possível criar a senha. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  async function voltar() {
    await supabase.auth.signOut({ scope: "local" });
    onConcluir();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Criar nova senha</h2>
        <p className="text-sm text-muted-foreground">
          Escolha a nova senha do seu acesso{email ? ` (${email})` : ""}. Depois você entra com ela.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="recuperar-nova">Nova senha</Label>
        <Input
          id="recuperar-nova"
          type="password"
          autoComplete="new-password"
          value={nova}
          onChange={(ev) => setNova(ev.target.value)}
          placeholder="Mínimo de 8 caracteres"
          aria-invalid={!!aviso}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recuperar-confirma">Confirmar nova senha</Label>
        <Input
          id="recuperar-confirma"
          type="password"
          autoComplete="new-password"
          value={confirma}
          onChange={(ev) => setConfirma(ev.target.value)}
          required
        />
        {aviso && <p className="text-xs text-destructive">{aviso}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={salvando || !!problema}>
        {salvando ? "Salvando…" : "Criar nova senha"}
      </Button>
      <div className="text-center">
        {/* Link de texto, sem o relevo global dos botões. */}
        <button
          type="button"
          data-depth="off"
          onClick={voltar}
          className="text-sm text-primary hover:underline"
        >
          Voltar para o login
        </button>
      </div>
    </form>
  );
}
