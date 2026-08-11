import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LandingFx } from "@/components/brand/LandingFx";

interface Recurso {
  titulo: string;
  descricao: string;
}

interface AuthSplitLayoutProps {
  /** Título grande exibido no painel de marca (lado esquerdo). */
  bannerTitulo?: string;
  /** Subtítulo do painel de marca. */
  bannerSubtitulo?: string;
  /** Nome do portal, sinalizado em destaque acima do formulário. */
  portalNome?: string;
  /** Descrição curta do portal exibida abaixo do nome. */
  portalDescricao?: string;
  /** Lista de recursos exibida no painel de marca (somente texto, sem ícones). */
  recursos?: Recurso[];
  children: ReactNode;
}

const RECURSOS_PADRAO: Recurso[] = [
  { titulo: "Simulações & propostas", descricao: "Compare bancos e envie em minutos." },
  { titulo: "Contratos & esteira", descricao: "Acompanhe cada etapa até a assinatura." },
  { titulo: "Financeiro & comissões", descricao: "Repasses e recebíveis sob controle." },
];

/**
 * Layout de autenticação em tela dividida: painel de marca editorial à
 * esquerda (telas grandes) e o formulário à direita, com o portal sinalizado.
 */
export function AuthSplitLayout({
  bannerTitulo = "Sua operação de crédito imobiliário, organizada.",
  bannerSubtitulo = "Uma plataforma completa para conduzir cada negócio do início ao fim.",
  portalNome = "Portal do Correspondente",
  portalDescricao,
  recursos = RECURSOS_PADRAO,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — visível em telas grandes. */}
      <aside className="auth-brand-panel relative hidden flex-col justify-between overflow-hidden p-10 xl:p-16 lg:flex">
        <LandingFx className="auth-fx" />
        <div className="relative z-10 flex items-center justify-between">
          <Logo variant="light" className="h-10" />
          <span className="rounded-full border border-white/15 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-primary-foreground/80">
            {portalNome}
          </span>
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-primary-foreground xl:text-[3.25rem]">
            {bannerTitulo}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-primary-foreground/65">
            {bannerSubtitulo}
          </p>

          <div className="mt-12 space-y-px overflow-hidden rounded-2xl border border-white/10">
            {recursos.map((r) => (
              <div
                key={r.titulo}
                className="flex items-baseline gap-4 border-l-2 border-transparent bg-white/[0.04] px-5 py-4 transition-colors hover:border-l-primary-foreground/40"
              >
                <span className="w-24 shrink-0 text-sm font-semibold text-primary-foreground">
                  {r.titulo.split(" & ")[0]}
                </span>
                <span className="text-sm text-primary-foreground/60">{r.descricao}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/45">
          © {new Date().getFullYear()} Agilliza · Crédito imobiliário
        </p>
      </aside>

      {/* Formulário. */}
      <main className="relative flex flex-col overflow-hidden bg-[var(--brand-azul-noite)] px-4 py-8 sm:px-8 lg:bg-muted">
        <LandingFx className="auth-fx-mobile lg:hidden" />
        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground lg:text-muted-foreground lg:hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur lg:hidden">
            {portalNome}
          </span>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="auth-form-card rounded-2xl border border-border p-6 sm:p-8">
              <div className="mb-8 flex flex-col items-center gap-5 text-center">
                <Logo variant="dark" className="h-12" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{portalNome}</p>
                  {portalDescricao && (
                    <p className="mt-1 text-sm text-muted-foreground">{portalDescricao}</p>
                  )}
                </div>
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
