import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Loader2, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AdminHero } from "@/components/admin/admin-hero";
import { BiometriaCard } from "@/components/pwa/biometria-card";
import { concluirSenhaProvisoria } from "@/lib/conta/senha-provisoria.functions";

export const Route = createFileRoute("/_authenticated/conta/seguranca")({
  head: () => ({ meta: [{ title: "Segurança — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Senha provisória (sorteada e enviada por e-mail): a pessoa só sai desta tela depois de
  // definir a dela.
  const [provisoria, setProvisoria] = useState(false);
  const [meuEmail, setMeuEmail] = useState("");
  const [senhaJaTrocada, setSenhaJaTrocada] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const concluirFn = useServerFn(concluirSenhaProvisoria);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setProvisoria(u?.app_metadata?.senha_provisoria === true);
      setMeuEmail((u?.email ?? "").toLowerCase());
    });
  }, []);

  // Regra mínima: 8+ caracteres com letra e número, diferente da atual. Antes
  // bastavam 8 caracteres quaisquer e não se pedia a senha atual — quem
  // pegasse a sessão aberta trocava a senha do dono (QA 20/10).
  const senhaFraca =
    nova.length > 0 && !(nova.length >= 8 && /[A-Za-z]/.test(nova) && /\d/.test(nova));
  const igualAtual = nova.length > 0 && nova === atual;
  const igualEmail = nova.length > 0 && !!meuEmail && nova.trim().toLowerCase() === meuEmail;
  const podeSalvar =
    atual.length > 0 &&
    nova.length >= 8 &&
    !senhaFraca &&
    !igualAtual &&
    !igualEmail &&
    nova === confirma;

  /**
   * Desliga a marca de senha provisória e renova a sessão (o token antigo ainda traz a
   * marca, e o guarda das rotas devolveria a pessoa para cá). Leva ao início certo:
   * "/" é a tela pública de escolha de acesso, não o sistema.
   */
  async function liberarAcesso() {
    await concluirFn();
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const sessao = queryClient.getQueryData<{ profile?: { acesso_tipo?: string | null } | null }>([
      "minha-sessao",
    ]);
    toast.success("Senha definida. Bem-vindo ao Agilliza.");
    navigate({
      to: sessao?.profile?.acesso_tipo === "portal_parceiro" ? "/parceiro-inicio" : "/dashboard",
      replace: true,
    });
  }

  async function alterarSenha() {
    // A senha já foi trocada e só faltou liberar o acesso: não pede a senha de novo.
    if (senhaJaTrocada) {
      setSalvando(true);
      try {
        await liberarAcesso();
      } catch {
        toast.error("Não foi possível liberar o acesso. Tente de novo em instantes.");
      } finally {
        setSalvando(false);
      }
      return;
    }
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("sem e-mail");
      const { error: erroAtual } = await supabase.auth.signInWithPassword({
        email,
        password: atual,
      });
      if (erroAtual) {
        toast.error("A senha atual não confere.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw error;
      if (provisoria) {
        // Daqui em diante a senha atual já é a nova: se liberar falhar, o botão só
        // repete a liberação (pedir a senha atual de novo travaria a pessoa aqui).
        setSenhaJaTrocada(true);
        setAtual("");
        setNova("");
        setConfirma("");
        try {
          await liberarAcesso();
        } catch {
          toast.error(
            "Sua senha foi alterada, mas não foi possível liberar o acesso. Clique em “Concluir” para tentar de novo.",
          );
        }
        return;
      }
      toast.success("Senha alterada com sucesso.");
      setAtual("");
      setNova("");
      setConfirma("");
    } catch {
      toast.error("Não foi possível alterar a senha. Faça login novamente e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Minha conta"
        icon={<Lock className="h-5 w-5" />}
        titulo="Segurança"
        descricao="Gerencie a senha de acesso e o desbloqueio por biometria."
      />

      {provisoria && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Defina a sua senha para continuar</p>
            <p className="text-muted-foreground">
              Você entrou com a senha provisória que chegou no seu e-mail. Em “Senha atual”, digite
              essa senha; depois escolha uma senha só sua. O sistema libera em seguida.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="atual">Senha atual</Label>
                <Input
                  id="atual"
                  type="password"
                  autoComplete="current-password"
                  value={atual}
                  onChange={(e) => setAtual(e.target.value)}
                  className="sm:max-w-[calc(50%-0.5rem)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova">Nova senha</Label>
                <Input
                  id="nova"
                  type="password"
                  autoComplete="new-password"
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  aria-invalid={senhaFraca || igualAtual || igualEmail}
                />
                {senhaFraca && (
                  <p className="text-xs text-destructive">
                    Use pelo menos 8 caracteres, com letras e números.
                  </p>
                )}
                {igualEmail && (
                  <p className="text-xs text-destructive">
                    A nova senha não pode ser o seu e-mail.
                  </p>
                )}
                {igualAtual && (
                  <p className="text-xs text-destructive">
                    A nova senha precisa ser diferente da atual.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirma">Confirmar nova senha</Label>
                <Input
                  id="confirma"
                  type="password"
                  autoComplete="new-password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                />
                {confirma.length > 0 && nova !== confirma && (
                  <p className="text-xs text-destructive">As senhas não coincidem.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Use uma senha forte com letras, números e símbolos.
              </p>
              <Button
                onClick={alterarSenha}
                disabled={(!podeSalvar && !senhaJaTrocada) || salvando}
              >
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {senhaJaTrocada ? "Concluir" : "Alterar senha"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Boas práticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              Use pelo menos 12 caracteres combinando maiúsculas, minúsculas, números e símbolos.
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              Nunca reutilize a senha de outros sistemas ou compartilhe com terceiros.
            </p>
            <p className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              Troque a senha periodicamente e ao suspeitar de qualquer acesso indevido.
            </p>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px]">
                Após alterar a senha, você pode ser desconectado em outros dispositivos.
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <BiometriaCard />
        </div>
      </div>
    </div>
  );
}
