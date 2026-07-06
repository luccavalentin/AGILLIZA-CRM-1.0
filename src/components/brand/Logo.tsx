import logoDark from "@/assets/brand/agilliza-logo-oficial.png";
import logoLight from "@/assets/brand/agilliza-logo-oficial-light.png";
import { cn } from "@/lib/utils";

type LogoVariant = "auto" | "light" | "dark";

interface LogoProps {
  /**
   * "auto" (default): mostra a versão azul em tema claro e a branca em tema escuro.
   * "light": sempre a versão branca (para fundos escuros).
   * "dark": sempre a versão azul (para fundos claros).
   */
  variant?: LogoVariant;
  className?: string;
}

/**
 * Logo oficial Agilliza. Usa exclusivamente os arquivos oficiais da marca.
 * Nunca substituir por texto estilizado.
 */
export function Logo({ variant = "auto", className }: LogoProps) {
  if (variant === "light") {
    return <img src={logoLight} alt="Agilliza" className={cn("h-9 w-auto", className)} />;
  }
  if (variant === "dark") {
    return <img src={logoDark} alt="Agilliza" className={cn("h-9 w-auto", className)} />;
  }
  return (
    <>
      <img src={logoDark} alt="Agilliza" className={cn("h-9 w-auto dark:hidden", className)} />
      <img
        src={logoLight}
        alt="Agilliza"
        className={cn("hidden h-9 w-auto dark:block", className)}
      />
    </>
  );
}
