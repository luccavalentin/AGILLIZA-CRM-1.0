import { useEffect, useState } from "react";
import { Fingerprint, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ErroBiometria,
  biometriaAtiva,
  biometriaDisponivel,
  guardarSessaoBiometria,
  impedimentoBiometria,
  registrarBiometria,
} from "@/lib/pwa/biometria";

const CHAVE_DISPENSADO = "agilliza:biometria-convite-dispensado";

/**
 * Convite para ativar a digital logo depois do primeiro login, como fazem os
 * apps de banco. Sem isto a biometria dependia de o usuário achar a chave em
 * Minha conta · Segurança — e a tela de login nunca chegava a oferecer nada.
 */
export function BiometriaConvite({
  userId,
  email,
  nome,
}: {
  userId: string;
  email: string | null;
  nome: string | null;
}) {
  const [visivel, setVisivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (biometriaAtiva(userId)) return;
    if (impedimentoBiometria()) return;
    try {
      if (localStorage.getItem(CHAVE_DISPENSADO) === "1") return;
    } catch {
      return;
    }

    let vivo = true;
    void biometriaDisponivel().then((ok) => {
      if (vivo && ok) setVisivel(true);
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  function dispensar() {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      /* ignore */
    }
  }

  async function ativar() {
    setOcupado(true);
    try {
      // Chamada direta no clique: qualquer espera antes daqui derruba a
      // permissão de gesto e o aparelho recusa o cadastro.
      await registrarBiometria({ userId, email, nome });
      // Guarda a sessão já protegida pela digital: sem isso, a primeira saída
      // do app deixaria a biometria sem o que restaurar.
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token && data.session.refresh_token) {
        guardarSessaoBiometria(userId, {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      toast.success("Biometria ativada. Da próxima vez, entre com a digital.");
      setVisivel(false);
    } catch (e) {
      toast.error(e instanceof ErroBiometria ? e.message : "Não foi possível ativar a biometria.");
    } finally {
      setOcupado(false);
    }
  }

  if (!visivel) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Entrar com a digital</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ative para abrir o Agilliza com a digital ou o rosto neste aparelho, sem digitar a
              senha toda vez.
            </p>
          </div>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Dispensar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={dispensar}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={ativar}
            disabled={ocupado}
            className="inline-flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
          >
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            Ativar
          </button>
        </div>
      </div>
    </div>
  );
}
