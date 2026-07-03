import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
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
    ],
  }),
  component: PortalParceiro,
});

function PortalParceiro() {
  const navigate = useNavigate();
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
      const sessao = await getMinhaSessao();

      if (!sessao.profile?.ativo || sessao.profile?.bloqueado_em) {
        await supabase.auth.signOut();
        toast.error("Seu acesso está inativo.");
        return;
      }

      const parceiro =
        ehPapelParceiro(sessao.roles) ||
        sessao.profile.acesso_tipo === "portal_parceiro";

      if (!parceiro) {
        await supabase.auth.signOut();
        toast.error("Acesso restrito.");
        return;
      }
      // Telas internas do parceiro entram nas Etapas 03–10.
      toast.success("Acesso confirmado.");
      navigate({ to: "/parceiro" });
    } catch {
      toast.error(ERRO_CREDENCIAIS);
    } finally {
      setCarregando(false);
    }
  }

  async function esqueciSenha() {
    const email = prompt("Informe seu e-mail para redefinir a senha:");
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/parceiro`,
    });
    toast.success("Se o e-mail existir, você receberá as instruções.");
  }

  return (
    <AuthSplitLayout
      bannerTitulo="Traga clientes e acompanhe a esteira."
      bannerSubtitulo="Portal exclusivo para imobiliárias e corretores parceiros."
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Portal do Parceiro</h1>
        <p className="text-sm text-muted-foreground">
          Entre com e-mail e senha fornecidos pelo correspondente.
        </p>
      </div>

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

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ainda não é parceiro cadastrado? Fale com o correspondente que trabalha
        com você para cadastrá-lo.
      </p>
    </AuthSplitLayout>
  );
}
