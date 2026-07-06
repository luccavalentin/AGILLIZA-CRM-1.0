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
    <div className="flex min-h-[100dvh] flex-col bg-muted">
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex justify-center">
              <Logo variant="dark" className="h-11" />
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
