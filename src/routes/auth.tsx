import { useState } from "react";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import { ERRO_CREDENCIAIS, portaEntradaDeRoles, destinoPosLogin } from "@/lib/auth-routing";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Agilliza" },
      { name: "robots", content: "noindex" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Agilliza" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/app/apple-touch-icon.png" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const senha = String(form.get("senha"));
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        toast.error(ERRO_CREDENCIAIS);
        return;
      }
      // Busca sessão e permissões em paralelo já no login. Assim o shell
      // interno encontra os dados prontos no cache e não refaz as consultas,
      // eliminando o round-trip extra que deixava a entrada lenta.
      const queryClient = router.options.context.queryClient;
      const [sessao, permissoes] = await Promise.all([
        getMinhaSessao(),
        getMinhasPermissoes().catch(() => null),
      ]);

      if (!sessao.profile?.ativo || sessao.profile?.bloqueado_em) {
        await supabase.auth.signOut();
        toast.error("Seu acesso está inativo. Fale com o correspondente.");
        return;
      }

      const porta = portaEntradaDeRoles(sessao.roles);
      if (porta === "cliente") {
        await supabase.auth.signOut();
        toast.info("Use o Portal do Cliente para acessar.");
        navigate({ to: "/portal" });
        return;
      }
      if (porta === "parceiro" || sessao.profile.acesso_tipo === "portal_parceiro") {
        await supabase.auth.signOut();
        toast.info("Use o Portal do Parceiro para acessar.");
        navigate({ to: "/parceiro" });
        return;
      }

      // Semeia o cache para o shell interno abrir instantaneamente.
      queryClient.setQueryData(["minha-sessao"], sessao);
      if (permissoes) queryClient.setQueryData(["minhas-permissoes"], permissoes);

      router.invalidate();
      navigate({ to: destinoPosLogin("sistema") });
    } catch {
      toast.error(ERRO_CREDENCIAIS);
    } finally {
      setCarregando(false);
    }
  }

  async function criarConta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nome = String(form.get("nome"));
    const email = String(form.get("email"));
    const senha = String(form.get("senha"));
    const confirmar = String(form.get("confirmar"));
    const aceite = form.get("aceite");

    if (senha !== confirmar) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (senha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (!aceite) {
      toast.error("É necessário aceitar os termos e a política de privacidade.");
      return;
    }

    setCarregando(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: nome,
            papel_inicial: "correspondente",
          },
        },
      });
      if (error) {
        toast.error("Não foi possível criar a conta. Tente novamente.");
        return;
      }
      toast.success("Confirme seu e-mail para ativar a conta.");
    } catch {
      toast.error("Não foi possível criar a conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function esqueciSenha() {
    const email = prompt("Informe seu e-mail para redefinir a senha:");
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    toast.success("Se o e-mail existir, você receberá as instruções.");
  }

  return (
    <AuthSplitLayout
      portalNome="Portal do Correspondente"
      portalDescricao="Acesse sua operação de crédito imobiliário."
      bannerTitulo="Sua operação de crédito imobiliário, organizada."
      bannerSubtitulo="Simulações, propostas, contratos, financeiro e comissões em um só lugar."
    >

      <Tabs defaultValue="entrar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="entrar">Entrar</TabsTrigger>
          <TabsTrigger value="criar">Criar conta</TabsTrigger>
        </TabsList>

        <TabsContent value="entrar">
          <form onSubmit={entrar} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">E-mail</Label>
              <Input id="login-email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="button"
              onClick={esqueciSenha}
              className="text-sm text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="criar">
          <form onSubmit={criarConta} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-nome">Nome completo</Label>
              <Input id="reg-nome" name="nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">E-mail</Label>
              <Input id="reg-email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-senha">Senha</Label>
              <Input
                id="reg-senha"
                name="senha"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-conf">Confirmar senha</Label>
              <Input
                id="reg-conf"
                name="confirmar"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox name="aceite" id="reg-aceite" className="mt-0.5" />
              <span>Li e aceito os termos de uso e a política de privacidade.</span>
            </label>
            <Button type="submit" className="w-full" disabled={carregando}>
              {carregando ? "Criando…" : "Criar conta de correspondente"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link
          to="/politica-de-privacidade"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Política de Privacidade
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
