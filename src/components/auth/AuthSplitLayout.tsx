import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface AuthSplitLayoutProps {
  /** Mantidos por compatibilidade; não exibidos após remoção do banner. */
  bannerTitulo?: string;
  bannerSubtitulo?: string;
  children: ReactNode;
}

/**
 * Layout de autenticação: apenas o formulário de login centralizado.
 */
export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
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
