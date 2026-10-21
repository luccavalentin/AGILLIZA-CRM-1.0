import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "agilliza:cookie-consent";

// Chave antiga que guardava e-mail/CPF/CNPJ do último login em texto puro e
// nunca era lida. Removida em todo carregamento para limpar navegadores que
// ainda a têm.
const CHAVE_LEGADA_LOGIN = "last_logged_in_email";

/**
 * Aviso de cookies (LGPD art. 9º). A plataforma usa só cookies e
 * armazenamento local essenciais (sessão, tema, preferências) e nenhum script
 * de análise ou publicidade, por isso o aviso é informativo: não há escolha a
 * respeitar. Se um dia entrar algo não essencial, volte a pedir consentimento
 * e faça esse script ler a escolha antes de carregar.
 */
export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.removeItem(CHAVE_LEGADA_LOGIN);
    } catch {
      /* storage indisponível */
    }
    try {
      const salvo = window.localStorage.getItem(STORAGE_KEY);
      // "accepted"/"rejected" são valores da versão anterior: quem já respondeu
      // não vê o aviso de novo.
      if (!salvo) setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  function fechar() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "ciente");
      window.localStorage.setItem(`${STORAGE_KEY}:em`, new Date().toISOString());
    } catch {
      /* ignora indisponibilidade de storage */
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    // Não é modal: "region" (antes "dialog") e a faixa transparente não bloqueia
    // cliques — dentro do sistema ela cobria a tabela de faturas. No desktop o
    // cartão fica no canto, fora do centro das tabelas. A escolha fica salva no
    // navegador, então aparece uma vez só.
    <div
      role="region"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] px-3 pb-3"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-lg sm:flex-row sm:items-center lg:mr-3 lg:max-w-xl">
        <Cookie className="hidden h-6 w-6 shrink-0 text-primary sm:block" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground">
          Usamos apenas cookies essenciais para o funcionamento da plataforma, como manter você
          conectado. Saiba mais na nossa{" "}
          <Link
            to="/politica-de-privacidade"
            className="font-medium text-primary underline underline-offset-2"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={fechar}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
