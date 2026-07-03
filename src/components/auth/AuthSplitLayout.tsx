import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface AuthSplitLayoutProps {
  /** Título exibido no banner lateral. */
  bannerTitulo: string;
  bannerSubtitulo: string;
  children: ReactNode;
}

/**
 * Layout split reutilizável para telas de login (banner à esquerda,
 * formulário à direita). Responsivo: em telas pequenas o banner some.
 */
export function AuthSplitLayout({
  bannerTitulo,
  bannerSubtitulo,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background lg:flex-row">
      {/* Banner */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:w-[45%]">
        <Logo variant="light" className="h-9" />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">{bannerTitulo}</h2>
          <p className="mt-3 text-primary-foreground/80">{bannerSubtitulo}</p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Agilliza — Crédito Imobiliário.
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="lg:hidden">
            <Logo variant="dark" className="h-7" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
