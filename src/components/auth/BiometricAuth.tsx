import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  biometriaAtiva,
  marcarAppDesbloqueado,
  mensagemErroBiometria,
  ultimaBiometria,
  verificarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Acesso por biometria na tela de login, no formato dos apps de banco: a
 * digital aparece primeiro, com a conta salva no aparelho, e a senha fica
 * como alternativa logo abaixo.
 *
 * Só aparece quando existe credencial cadastrada NESTE aparelho. Se a sessão
 * do Supabase tiver expirado, o card continua visível mas explica que é
 * preciso entrar uma vez com a senha — a biometria sozinha não autentica,
 * isso exigiria o servidor validar a assinatura da passkey.
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
  const [conta, setConta] = useState<{ userId: string; email: string | null } | null>(null);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
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
      const id = data.session?.user?.id ?? null;
      setTemSessao(Boolean(id) && biometriaAtiva(id));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = useCallback(async () => {
    if (!conta || verificando) return;

    if (temSessao === false) {
      setErro(
        "A sessão deste aparelho expirou. Entre uma vez com e-mail e senha para reativar a biometria.",
      );
      return;
    }

    setVerificando(true);
    setErro(null);
    try {
      // Sem `await` antes daqui: o navegador exige o gesto do usuário ainda
      // válido para abrir o pedido de digital/rosto.
      const r = await verificarBiometria(conta.userId);
      if (!r.ok) {
        setErro(
          r.codigo && r.codigo !== "cancelado"
            ? mensagemErroBiometria(r.codigo)
            : "Não deu para confirmar a biometria. Toque para tentar de novo.",
        );
        return;
      }
      marcarAppDesbloqueado();
      navigate({ to: destino, replace: true });
    } finally {
      setVerificando(false);
    }
  }, [conta, destino, navigate, temSessao, verificando]);

  // Como app de banco: já pede a digital ao abrir. Onde o navegador exige
  // gesto do usuário (Safari), a chamada falha em silêncio e o botão fica.
  useEffect(() => {
    if (!conta || temSessao !== true || disabled || tentouSozinho.current) return;
    tentouSozinho.current = true;
    const t = window.setTimeout(() => void entrar(), 600);
    return () => window.clearTimeout(t);
  }, [conta, temSessao, disabled, entrar]);

  if (!conta) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 text-center">
        <button
          type="button"
          onClick={entrar}
          disabled={disabled || verificando}
          aria-label="Entrar com biometria"
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 transition-transform active:scale-95 disabled:opacity-70"
        >
          {verificando ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : (
            <Fingerprint className="h-9 w-9" />
          )}
        </button>

        <p className="mt-3 text-sm font-semibold text-foreground">Entrar com biometria</p>
        {conta.email && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conta.email}</p>
        )}

        {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <span className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Ou entre com e-mail e senha
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
    </div>
  );
}
