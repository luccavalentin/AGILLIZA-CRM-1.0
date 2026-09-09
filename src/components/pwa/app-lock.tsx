import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  appDesbloqueado,
  biometriaAtiva,
  limparDesbloqueioApp,
  marcarAppDesbloqueado,
  mensagemErroBiometria,
  verificarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Tela de bloqueio do app, no mesmo espírito da dos apps de banco: quando o
 * usuário ativa a biometria, o sistema volta bloqueado toda vez que o app é
 * aberto ou fica um tempo em segundo plano.
 *
 * Ela não substitui o login: a sessão continua sendo a do Supabase. É uma
 * trava de aparelho — impede que alguém que pegou o celular já destravado
 * entre na operação.
 */

/** Tempo em segundo plano a partir do qual o app volta bloqueado. */
const OCIOSO_MS = 60_000;

export function AppLock({
  userId,
  nome,
  onSair,
}: {
  userId: string;
  nome?: string | null;
  onSair: () => void;
}) {
  const ativa = biometriaAtiva(userId);
  // Recarregar a página dentro da mesma sessão não deve pedir a digital de
  // novo; fechar o app (que zera o sessionStorage) deve.
  const [bloqueado, setBloqueado] = useState(() => ativa && !appDesbloqueado());
  const [verificando, setVerificando] = useState(false);
  const [falhou, setFalhou] = useState<string | null>(null);
  const saiuEm = useRef<number | null>(null);
  const tentouSozinho = useRef(false);

  const destravar = useCallback(async () => {
    if (verificando) return;
    setVerificando(true);
    setFalhou(null);
    try {
      const r = await verificarBiometria(userId);
      if (r.ok) {
        marcarAppDesbloqueado();
        setBloqueado(false);
        return;
      }
      // Cancelar é o caso comum e não merece texto de erro; o resto merece,
      // porque diz ao usuário o que precisa mudar no aparelho.
      setFalhou(
        r.codigo && r.codigo !== "cancelado"
          ? mensagemErroBiometria(r.codigo)
          : "Toque no ícone para tentar de novo.",
      );
    } finally {
      setVerificando(false);
    }
  }, [userId, verificando]);

  // Volta a bloquear depois de um tempo em segundo plano.
  useEffect(() => {
    if (!ativa) return;
    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === "hidden") {
        saiuEm.current = Date.now();
        return;
      }
      const saida = saiuEm.current;
      saiuEm.current = null;
      if (saida && Date.now() - saida >= OCIOSO_MS) {
        limparDesbloqueioApp();
        tentouSozinho.current = false;
        setBloqueado(true);
      }
    };
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
  }, [ativa]);

  // Pede a biometria sozinho ao abrir, como faz app nativo. Em navegadores
  // que exigem gesto do usuário (Safari) a chamada falha em silêncio e o
  // botão continua ali.
  useEffect(() => {
    if (!bloqueado || tentouSozinho.current) return;
    if (document.visibilityState !== "visible") return;
    tentouSozinho.current = true;
    const t = window.setTimeout(() => {
      void destravar();
    }, 400);
    return () => window.clearTimeout(t);
  }, [bloqueado, destravar]);

  if (!ativa || !bloqueado) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo className="h-8" />

      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {nome ? `Olá, ${nome.split(" ")[0]}` : "App bloqueado"}
        </p>
        <p className="text-sm text-muted-foreground">Use sua biometria para voltar ao sistema.</p>
      </div>

      <button
        type="button"
        onClick={destravar}
        disabled={verificando}
        aria-label="Desbloquear com biometria"
        className="grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-transform active:scale-95 disabled:opacity-70"
      >
        {verificando ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Fingerprint className="h-10 w-10" />
        )}
      </button>

      {falhou && <p className="max-w-xs text-sm text-destructive">{falhou}</p>}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Sua sessão continua ativa neste aparelho.
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          limparDesbloqueioApp();
          onSair();
        }}
      >
        <LogOut className="mr-1.5 h-4 w-4" />
        Sair da conta
      </Button>
    </div>
  );
}
