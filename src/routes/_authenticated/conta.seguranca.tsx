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


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="flex justify-end">
            <Button onClick={alterarSenha} disabled={!podeSalvar || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
