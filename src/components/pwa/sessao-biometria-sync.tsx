import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { guardarSessaoBiometria } from "@/lib/pwa/biometria";

/**
 * Mantém atualizada a cópia da sessão protegida pela biometria.
 *
 * O refresh token do Supabase gira a cada renovação: sem isto, a cópia
 * guardada no cadastro venceria em poucas horas e a digital voltaria a
 * pedir e-mail e senha. Não faz nada quando a biometria não está ativa.
 */
export function SessaoBiometriaSync({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;

    void supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.access_token && s.refresh_token) {
        guardarSessaoBiometria(userId, {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") return;
      if (sessao?.access_token && sessao.refresh_token) {
        guardarSessaoBiometria(userId, {
          access_token: sessao.access_token,
          refresh_token: sessao.refresh_token,
        });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [userId]);

  return null;
}
