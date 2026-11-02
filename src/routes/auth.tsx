import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { BiometricAuth } from "@/components/auth/BiometricAuth";
import { NovaSenhaRecuperacao } from "@/components/auth/NovaSenhaRecuperacao";
import { marcarAppDesbloqueado } from "@/lib/pwa/biometria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import { ERRO_CREDENCIAIS, portaEntradaDeRoles, destinoPosLogin } from "@/lib/auth-routing";
import { pedirRecuperacaoDeSenha } from "@/lib/auth/recuperar-senha.functions";
import {
  LINK_DE_RECUPERACAO_INVALIDO,
  sessaoDeRecuperacao,
  voltouDoLinkDeRecuperacao,
} from "@/lib/auth/recuperacao";

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
  // Volta do link de "Esqueci minha senha": no lugar do login, o formulário de senha nova.
  const [recuperando, setRecuperando] = useState(false);
  const recuperandoRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    const abrirRecuperacao = () => {
      recuperandoRef.current = true;
      setRecuperando(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY" && vivo) abrirRecuperacao();
    });
    if (voltouDoLinkDeRecuperacao(window.location.search)) {
      // getSession espera o supabase-js terminar de ler o "#access_token…" da URL.
      void supabase.auth.getSession().then(async ({ data }) => {
        if (!vivo) return;
        const deLink = sessaoDeRecuperacao(data.session?.access_token);
        // Tira o "?recuperar=1" (e um "#error=…" de link vencido) da barra de endereço.
        void navigate({ to: "/auth", replace: true });
        if (deLink) {
          abrirRecuperacao();
          return;
        }
        // O evento PASSWORD_RECOVERY sai logo depois: dá um instante antes de dizer que falhou.
        await new Promise((r) => setTimeout(r, 400));
        if (vivo && !recuperandoRef.current) toast.error(LINK_DE_RECUPERACAO_INVALIDO);
      });
    }
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

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

      // Quem acabou de entrar com a senha não deve cair na tela de bloqueio.
      marcarAppDesbloqueado();
      router.invalidate();
      navigate({ to: destinoPosLogin("sistema") });
    } catch {
      toast.error(ERRO_CREDENCIAIS);
    } finally {
      setCarregando(false);
    }
  }

  // O link vai pelo e-mail da plataforma (o SMTP do Auth de produção não entrega: defeito de
  // 30/10/2026). A resposta é sempre a mesma, exista a conta ou não.
  async function esqueciSenha() {
    const email = prompt("Informe seu e-mail para redefinir a senha:");
    if (!email?.trim()) return;
    try {
      const r = await pedirRecuperacaoDeSenha({ data: { email: email.trim() } });
      toast.success(r.mensagem);
    } catch {
      toast.error("Não foi possível pedir a nova senha agora. Tente de novo em instantes.");
    }
  }

  return (
    <AuthSplitLayout
      portalNome="Portal do Correspondente"
      portalDescricao="Acesse sua operação de crédito imobiliário."
      bannerTitulo="Sua operação de crédito imobiliário, organizada."
      bannerSubtitulo="Simulações, propostas, contratos, financeiro e comissões em um só lugar."
    >
      {recuperando ? (
        <NovaSenhaRecuperacao
          onConcluir={() => {
            recuperandoRef.current = false;
            setRecuperando(false);
          }}
        />
      ) : (
        // O cadastro público está desligado (auditoria C1): quem entra recebe a conta da equipe.
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
          <BiometricAuth destino={destinoPosLogin("sistema")} disabled={carregando} />
        </form>
      )}
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
