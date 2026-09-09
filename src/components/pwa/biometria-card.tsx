import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  ErroBiometria,
  biometriaAtiva,
  biometriaDisponivel,
  desativarBiometria,
  guardarSessaoBiometria,
  impedimentoBiometria,
  mensagemErroBiometria,
  registrarBiometria,
  type CodigoErroBiometria,
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
  const [erro, setErro] = useState<string | null>(null);
  const [impedimento, setImpedimento] = useState<CodigoErroBiometria | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [ok, { data }] = await Promise.all([biometriaDisponivel(), supabase.auth.getUser()]);
      if (!vivo) return;
      setImpedimento(impedimentoBiometria());
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
      setErro(null);
      toast.success("Desbloqueio por biometria desativado neste aparelho.");
      return;
    }

    setOcupado(true);
    setErro(null);
    try {
      // Sem `await` antes daqui: o navegador exige o gesto do usuário ainda
      // válido para abrir o pedido de digital/rosto.
      await registrarBiometria({ userId, email, nome });
      setAtiva(true);
      // Guarda a sessão já protegida pela digital: sem isso, a primeira saída
      // do app deixaria a biometria sem o que restaurar.
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token && data.session.refresh_token) {
        guardarSessaoBiometria(userId, {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      toast.success("Pronto. O app vai pedir sua biometria ao abrir.");
    } catch (e) {
      const msg = e instanceof ErroBiometria ? e.message : mensagemErroBiometria("desconhecido");
      setErro(msg);
      toast.error(msg);
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
              disabled={!disponivel || Boolean(impedimento) || !userId || ocupado}
              onCheckedChange={(v) => void alternar(v)}
            />
          </div>
        </div>

        {(disponivel === false || impedimento) && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{mensagemErroBiometria(impedimento ?? "sem-leitor")}</span>
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
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
