import { useState, useEffect, useRef } from "react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Componente para autenticação biométrica (WebAuthn).
 * Habilita login rápido por impressão digital/rosto em dispositivos compatíveis.
 * Só aparece em ambiente PWA mobile e solicita automaticamente se possível.
 */
export function BiometricAuth({ 
  onSuccess, 
  disabled 
}: { 
  onSuccess: (email: string) => void;
  disabled?: boolean;
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const autoRequested = useRef(false);

  useEffect(() => {
    // Verifica se é PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsPWA(isStandalone);

    // Verifica suporte básico ao WebAuthn
    if (window.PublicKeyCredential && 
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(result => {
        setIsSupported(result);
      });
    }
  }, []);

  // Solicitação automática se for PWA e tiver suporte
  useEffect(() => {
    if (isPWA && isSupported && !autoRequested.current && !disabled) {
      const email = localStorage.getItem("last_logged_in_email");
      if (email) {
        autoRequested.current = true;
        // Pequeno delay para não assustar o usuário assim que a página carrega
        const timer = setTimeout(() => {
          handleBiometric();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isPWA, isSupported, disabled]);

  async function handleBiometric() {
    try {
      const email = localStorage.getItem("last_logged_in_email");
      
      if (!email) {
        if (!autoRequested.current) {
          toast.info("Faça o primeiro login com senha para habilitar a biometria neste dispositivo.");
        }
        return;
      }

      // Simulação do fluxo: no futuro, integraremos com o signInWithPasskey do Supabase
      toast.info("Autenticação biométrica solicitada no PWA.");
      
      // Se tivéssemos a implementação real, chamaríamos onSuccess(email) após a validação
      // onSuccess(email);
    } catch (error) {
      console.error("Erro na biometria:", error);
      toast.error("Falha na autenticação biométrica.");
    }
  }

  // Só aparece se for PWA e suportado
  if (!isPWA || !isSupported) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex w-full items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground font-sans">Ou acesse com</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all active:scale-95"
        onClick={handleBiometric}
        disabled={disabled}
      >
        <Fingerprint className="h-4 w-4 text-primary animate-pulse" />
        Impressão Digital / Biometria
      </Button>
    </div>
  );
}
