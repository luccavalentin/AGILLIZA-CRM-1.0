import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  biometriaAtiva,
  biometriaDisponivel,
  marcarAppDesbloqueado,
  verificarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Entrada rápida por biometria na tela de login.
 *
 * Só aparece quando as três condições existem ao mesmo tempo:
 *  1. o aparelho tem digital/rosto disponível para o navegador;
 *  2. o usuário já ativou a biometria em Minha conta · Segurança;
 *  3. a sessão do Supabase ainda está guardada neste navegador.
 *
 * Fora disso o botão não aparece: sem sessão guardada, a biometria sozinha
 * não consegue autenticar (isso exigiria o servidor validar a assinatura da
 * passkey), e mostrar um botão que não entra seria enganar o usuário.
 */
export function BiometricAuth({
  destino,
  disabled,
}: {
  /** Para onde ir depois de destravar. */
  destino: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const tentouSozinho = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [temLeitor, { data }] = await Promise.all([
        biometriaDisponivel(),
        supabase.auth.getSession(),
      ]);
      if (!vivo) return;
      const id = data.session?.user?.id ?? null;
      if (temLeitor && id && biometriaAtiva(id)) setUserId(id);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function entrar() {
    if (!userId || verificando) return;
    setVerificando(true);
    try {
      const ok = await verificarBiometria(userId);
      if (!ok) {
        toast.error("Não foi possível confirmar a biometria. Entre com e-mail e senha.");
        return;
      }
      marcarAppDesbloqueado();
      navigate({ to: destino, replace: true });
    } finally {
      setVerificando(false);
    }
  }

  // Como app nativo: já pede a biometria ao abrir. Onde o navegador exige
  // gesto do usuário (Safari), a chamada falha em silêncio e o botão fica.
  useEffect(() => {
    if (!userId || disabled || tentouSozinho.current) return;
    tentouSozinho.current = true;
    const t = window.setTimeout(() => {
      void entrar();
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, disabled]);

  if (!userId) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2 duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex w-full items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Ou acesse com
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 rounded-xl border-primary/20 bg-primary/5 transition-all hover:bg-primary/10 active:scale-95"
        onClick={entrar}
        disabled={disabled || verificando}
      >
        {verificando ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Fingerprint className="h-4 w-4 text-primary" />
        )}
        Entrar com biometria
      </Button>
    </div>
  );
}
