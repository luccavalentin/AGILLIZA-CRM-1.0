import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  lerSessaoBiometria,
  limparSessaoBiometria,
  marcarAppDesbloqueado,
  mensagemErroBiometria,
  ultimaBiometria,
  verificarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Entrada por biometria na tela de login: um botão discreto abaixo do
 * "Entrar", com a conta salva neste aparelho.
 *
 * Depois que o aparelho confirma a digital, a sessão guardada é restaurada
 * com `setSession` — é isso que faz a biometria realmente ENTRAR, e não
 * apenas destravar uma sessão que já estivesse aberta.
 */
export function BiometricAuth({
  destino,
  disabled,
}: {
  /** Para onde ir depois de entrar. */
  destino: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [conta, setConta] = useState<{ userId: string; email: string | null } | null>(null);
  const [pronto, setPronto] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tentouSozinho = useRef(false);

  useEffect(() => {
    const salva = ultimaBiometria();
    if (!salva) return;
    setConta(salva);

    let vivo = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      // Serve tanto a sessão ainda ativa quanto a cópia guardada no cadastro.
      setPronto(Boolean(data.session) || Boolean(lerSessaoBiometria(salva.userId)));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = useCallback(async () => {
    if (!conta || verificando) return;
    setVerificando(true);
    setErro(null);
    try {
      // Sem `await` antes daqui: a espera consome o gesto do usuário e o
      // navegador recusa o pedido de digital.
      const r = await verificarBiometria(conta.userId);
      if (!r.ok) {
        setErro(
          r.codigo && r.codigo !== "cancelado"
            ? mensagemErroBiometria(r.codigo)
            : "Não deu para confirmar a biometria.",
        );
        return;
      }

      const guardada = lerSessaoBiometria(conta.userId);
      if (guardada) {
        const { error } = await supabase.auth.setSession({
          access_token: guardada.access_token,
          refresh_token: guardada.refresh_token,
        });
        if (error) {
          // Token revogado ou vencido: não adianta insistir.
          limparSessaoBiometria(conta.userId);
          setErro("Sua sessão expirou. Entre uma vez com e-mail e senha para reativar.");
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setErro("Sua sessão expirou. Entre uma vez com e-mail e senha para reativar.");
          return;
        }
      }

      marcarAppDesbloqueado();
      navigate({ to: destino, replace: true });
    } finally {
      setVerificando(false);
    }
  }, [conta, destino, navigate, verificando]);

  // Como app de banco: pede a digital ao abrir. Onde o navegador exige gesto
  // do usuário (Safari), a chamada falha em silêncio e o botão fica.
  useEffect(() => {
    if (!conta || !pronto || disabled || tentouSozinho.current) return;
    tentouSozinho.current = true;
    const t = window.setTimeout(() => void entrar(), 500);
    return () => window.clearTimeout(t);
  }, [conta, pronto, disabled, entrar]);

  if (!conta) return null;

  return (
    <div className="pt-1 text-center">
      <button
        type="button"
        onClick={entrar}
        disabled={disabled || verificando}
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
      >
        {verificando ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Fingerprint className="h-4 w-4 text-primary" />
        )}
        Entrar com biometria
      </button>

      {conta.email && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{conta.email}</p>
      )}
      {erro && <p className="mt-1.5 text-[11px] text-destructive">{erro}</p>}
    </div>
  );
}
