import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  biometriaAtiva,
  biometriaDisponivel,
  desativarBiometria,
  registrarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Ativa o desbloqueio por digital/rosto neste aparelho. O cadastro é local:
 * cada celular ou computador precisa ser habilitado uma vez.
 */
export function BiometriaCard() {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [ok, { data }] = await Promise.all([biometriaDisponivel(), supabase.auth.getUser()]);
      if (!vivo) return;
      setDisponivel(ok);
      const u = data.user;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      setNome((u?.user_metadata?.nome as string | undefined) ?? null);
      setAtiva(biometriaAtiva(u?.id));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(valor: boolean) {
    if (!userId) return;

    if (!valor) {
      desativarBiometria(userId);
      setAtiva(false);
      toast.success("Desbloqueio por biometria desativado neste aparelho.");
      return;
    }

    setOcupado(true);
    try {
      const ok = await registrarBiometria({ userId, email, nome });
      if (!ok) {
        toast.error("Não foi possível cadastrar a biometria neste aparelho.");
        return;
      }
      setAtiva(true);
      toast.success("Pronto. O app vai pedir sua biometria ao abrir.");
    } catch {
      toast.error("Cadastro cancelado ou não permitido pelo aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Fingerprint className="h-4 w-4 text-primary" />
          Desbloqueio por biometria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="biometria" className="text-sm font-medium">
              Pedir digital ou rosto ao abrir o app
            </Label>
            <p className="text-xs text-muted-foreground">
              Usa a digital, o Face ID ou o Windows Hello do próprio aparelho. Vale só neste
              dispositivo — habilite em cada um que você usa.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="biometria"
              checked={ativa}
              disabled={!disponivel || !userId || ocupado}
              onCheckedChange={(v) => void alternar(v)}
            />
          </div>
        </div>

        {disponivel === false && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Este aparelho não oferece leitor de digital, Face ID ou Windows Hello para o
              navegador. Em celular, instale o app na tela inicial e tente de novo.
            </span>
          </div>
        )}

        {ativa && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              O app volta bloqueado ao ser aberto e depois de um minuto em segundo plano. É uma
              trava do aparelho: sua senha continua sendo o acesso à conta.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
