import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import {
  appDesbloqueado,
  biometriaAtiva,
  limparDesbloqueioApp,
  marcarAppDesbloqueado,
  mensagemErroBiometria,
  verificarBiometria,
} from "@/lib/pwa/biometria";

/**
 * Tela de bloqueio do app, no mesmo espírito da dos apps de banco: com a
 * biometria ativa, o sistema volta bloqueado quando o app é reaberto ou
 * fica um tempo em segundo plano.
 *
 * Não substitui o login: a sessão continua sendo a do Supabase. É uma trava
 * de aparelho — impede que alguém que pegou o celular já destravado entre
 * na operação.
 *
 * As cores são fixas (azul da marca) em vez de seguirem o tema: esta tela
 * cobre o app inteiro e precisa ficar legível antes de qualquer decisão de
 * tema, sem depender de qual classe está no <html>.
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
  const [erro, setErro] = useState<string | null>(null);
  const saiuEm = useRef<number | null>(null);
  const tentouSozinho = useRef(false);

  const destravar = useCallback(
    async (automatico: boolean) => {
      if (verificando) return;
      setVerificando(true);
      setErro(null);
      try {
        const r = await verificarBiometria(userId);
        if (r.ok) {
          marcarAppDesbloqueado();
          setBloqueado(false);
          return;
        }
        // A tentativa automática não vira mensagem de erro: o usuário pode
        // simplesmente não ter encostado o dedo ainda.
        if (automatico) return;
        setErro(
          r.codigo && r.codigo !== "cancelado"
            ? mensagemErroBiometria(r.codigo)
            : "Não deu para confirmar. Toque para tentar de novo.",
        );
      } finally {
        setVerificando(false);
      }
    },
    [userId, verificando],
  );

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
    const t = window.setTimeout(() => void destravar(true), 400);
    return () => window.clearTimeout(t);
  }, [bloqueado, destravar]);

  if (!ativa || !bloqueado) return null;

  const primeiroNome = nome?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-[#00052E] px-6 py-10 text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {/* `variant="light"` explícito: a versão "auto" some quando a classe
            de tema do <html> não bate com o fundo — era o logo invisível,
            sobrando só o traço vermelho. Sobre o azul da marca, a versão
            branca é a mesma do lado escuro da tela de login. */}
        <Logo variant="light" className="h-9" />

        <div className="space-y-1.5">
          <p className="text-[22px] font-semibold leading-tight tracking-tight">
            {primeiroNome ? `Olá, ${primeiroNome}` : "Bem-vindo de volta"}
          </p>
          <p className="text-sm text-white/55">Confirme sua biometria para continuar</p>
        </div>

        <button
          type="button"
          onClick={() => void destravar(false)}
          disabled={verificando}
          aria-label="Desbloquear com biometria"
          className="group relative grid h-28 w-28 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-80"
        >
          {/* Halo suave, no lugar de um círculo chapado. */}
          <span className="absolute inset-0 rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/15" />
          <span className="absolute inset-0 animate-ping rounded-full bg-white/[0.04] [animation-duration:2.4s]" />
          {verificando ? (
            <Loader2 className="relative h-11 w-11 animate-spin text-white/90" />
          ) : (
            <Fingerprint className="relative h-11 w-11 text-white/90" />
          )}
        </button>

        <div className="h-5">
          {erro ? (
            <p className="max-w-xs text-xs text-red-300">{erro}</p>
          ) : (
            <p className="text-xs text-white/40">Toque para usar a digital ou o rosto</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          limparDesbloqueioApp();
          onSair();
        }}
        className="text-xs font-medium text-white/50 underline-offset-4 transition-colors hover:text-white/80 hover:underline"
      >
        Sair da conta
      </button>
    </div>
  );
}
