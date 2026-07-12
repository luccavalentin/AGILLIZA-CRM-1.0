import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "agilliza:cookie-consent";

type Consent = "accepted" | "rejected";

/**
 * Aviso de consentimento de cookies (LGPD art. 8º/9º).
 * Persiste a escolha em localStorage. Só cookies essenciais são usados
 * enquanto o titular não aceitar os demais.
 */
export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(STORAGE_KEY);
      if (salvo !== "accepted" && salvo !== "rejected") setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  function decidir(valor: Consent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, valor);
      window.localStorage.setItem(`${STORAGE_KEY}:em`, new Date().toISOString());
    } catch {
      /* ignora indisponibilidade de storage */
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-lg sm:flex-row sm:items-center">
        <Cookie className="hidden h-6 w-6 shrink-0 text-primary sm:block" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground">
          Utilizamos cookies essenciais para o funcionamento da plataforma e, com o seu
          consentimento, cookies para melhorar sua experiência. Saiba mais na nossa{" "}
          <Link
            to="/politica-de-privacidade"
            className="font-medium text-primary underline underline-offset-2"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decidir("rejected")}>
            Rejeitar
          </Button>
          <Button size="sm" onClick={() => decidir("accepted")}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
