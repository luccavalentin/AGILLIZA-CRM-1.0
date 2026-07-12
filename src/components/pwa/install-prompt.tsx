import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Download, X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "agilliza-pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect touch Mac
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOs;
}

/**
 * Prompt de instalação do app principal (Correspondente/Parceiro).
 * - Chrome/Android: usa o evento nativo beforeinstallprompt.
 * - iOS/Safari: mostra instruções (Compartilhar → Adicionar à Tela de Início).
 * Não aparece nas rotas do portal do cliente (/cliente), que têm PWA próprio.
 */
export function InstallPrompt() {
  const location = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  const onClientePortal = location.pathname.startsWith("/cliente");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (onClientePortal) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS não dispara beforeinstallprompt: mostra o card de instruções.
    if (isIos()) {
      const t = window.setTimeout(() => setVisible(true), 1500);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [onClientePortal]);

  useEffect(() => {
    const installed = () => setVisible(false);
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, []);

  if (!visible || onClientePortal) return null;

  const dismiss = () => {
    setVisible(false);
    setIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
      if (choice.outcome === "dismissed") {
        try {
          localStorage.setItem(DISMISS_KEY, "1");
        } catch {
          /* ignore */
        }
      }
      return;
    }
    // Sem evento nativo (iOS) → mostra instruções.
    setIosHelp(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <img
            src="/icons/app/icon-192.png"
            alt="Agilliza"
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Instalar o app Agilliza</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Acesso rápido pela tela inicial, em tela cheia e sem barra do navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {iosHelp ? (
          <div className="border-t border-border bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-foreground">Como instalar no iPhone/iPad:</p>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-background text-[10px] font-bold text-foreground">1</span>
                Toque em <Share className="mx-0.5 inline h-3.5 w-3.5" /> Compartilhar
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-background text-[10px] font-bold text-foreground">2</span>
                Escolha <Plus className="mx-0.5 inline h-3.5 w-3.5" /> "Adicionar à Tela de Início"
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-background text-[10px] font-bold text-foreground">3</span>
                Confirme em "Adicionar"
              </li>
            </ol>
          </div>
        ) : (
          <div className="flex gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={install}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Instalar app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
