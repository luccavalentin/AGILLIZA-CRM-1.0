import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Loader2, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AdminHero } from "@/components/admin/admin-hero";

export const Route = createFileRoute("/_authenticated/conta/seguranca")({
  head: () => ({ meta: [{ title: "Segurança — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeSalvar = nova.length >= 8 && nova === confirma;

  async function alterarSenha() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
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
        descricao="Gerencie a senha de acesso à sua conta."
      />

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
              <div className="space-y-1.5">
                <Label htmlFor="nova">Nova senha</Label>
                <Input
                  id="nova"
                  type="password"
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirma">Confirmar nova senha</Label>
                <Input
                  id="confirma"
                  type="password"
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
              <Button onClick={alterarSenha} disabled={!podeSalvar || salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar senha
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
      </div>
    </div>
  );
}
