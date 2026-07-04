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
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-[#000a70] p-12 text-primary-foreground lg:flex lg:w-[45%]">
        {/* Ornamento sutil de fundo */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-foreground/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary-foreground/5 blur-2xl" />
        <Logo variant="light" className="relative h-12" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">{bannerTitulo}</h2>
          <p className="mt-4 text-lg leading-relaxed text-primary-foreground/80">{bannerSubtitulo}</p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
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
