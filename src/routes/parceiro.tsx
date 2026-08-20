import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { BiometricAuth } from "@/components/auth/BiometricAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMinhaSessao } from "@/lib/session.functions";
import { ERRO_CREDENCIAIS, ehPapelParceiro } from "@/lib/auth-routing";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Portal do Parceiro — Agilliza" },
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
  component: PortalParceiro,
});

function PortalParceiro() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);

  const sessaoQuery = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
    retry: false,
  });

  const sessao = sessaoQuery.data;
  const autorizado =
    !!sessao?.profile?.ativo &&
    !sessao.profile.bloqueado_em &&
    sessao.profile.acesso_tipo === "portal_parceiro" &&
    (ehPapelParceiro(sessao.roles) || sessao.profile.acesso_tipo === "portal_parceiro");

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
      const s = await getMinhaSessao();
      if (!s.profile?.ativo || s.profile?.bloqueado_em) {
        await supabase.auth.signOut();
        toast.error("Seu acesso está inativo.");
        return;
      }
      if (s.profile.acesso_tipo !== "portal_parceiro") {
        await supabase.auth.signOut();
        toast.error("Este acesso não pertence ao Portal do Parceiro.");
        return;
      }
      // Salva o e-mail para habilitar biometria futura
      localStorage.setItem("last_logged_in_email", email);

      await queryClient.invalidateQueries({ queryKey: ["minha-sessao"] });
      toast.success("Bem-vindo(a) de volta.");
    } catch {
      toast.error(ERRO_CREDENCIAIS);
    } finally {
      setCarregando(false);
    }
  }

  // Parceiro autenticado usa o mesmo shell/páginas do correspondente,
  // com menu e escopo definidos pela matriz de permissões (Regras & Módulos).
  useEffect(() => {
    if (autorizado) {
      navigate({ to: "/parceiro-inicio", replace: true });
    }
  }, [autorizado, navigate]);

  if (sessaoQuery.isLoading || autorizado) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthSplitLayout
      portalNome="Portal do Parceiro"
      portalDescricao="Entre com e-mail e senha fornecidos pelo correspondente."
      bannerTitulo="Traga clientes e acompanhe a esteira."
      bannerSubtitulo="Portal exclusivo para imobiliárias e corretores parceiros."
      recursos={[
        { titulo: "Indicações", descricao: "Cadastre e acompanhe seus clientes." },
        { titulo: "Esteira", descricao: "Veja cada etapa até a assinatura." },
        { titulo: "Comissões", descricao: "Acompanhe seus repasses e recebíveis." },
      ]}
    >
      <form onSubmit={entrar} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="p-email">E-mail</Label>
          <Input id="p-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-senha">Senha</Label>
          <Input
            id="p-senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
        <BiometricAuth
          onSuccess={(email) => console.log("Biometria parceiro:", email)}
          disabled={carregando}
        />
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ainda não é parceiro cadastrado? Fale com o correspondente que trabalha com você para
        cadastrá-lo.
      </p>
    </AuthSplitLayout>
  );
}
