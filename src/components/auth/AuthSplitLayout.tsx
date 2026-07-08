import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface Destaque {
  icon: LucideIcon;
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
  /** Itens de destaque exibidos no painel de marca. */
  destaques?: Destaque[];
  children: ReactNode;
}

const DESTAQUES_PADRAO: Destaque[] = [
  {
    icon: Sparkles,
    titulo: "Tudo em um só lugar",
    descricao: "Simulações, propostas, contratos, financeiro e comissões integrados.",
  },
  {
    icon: ShieldCheck,
    titulo: "Segurança e conformidade",
    descricao: "Seus dados protegidos, com controle de acesso por perfil.",
  },
];

/**
 * Layout de autenticação em tela dividida: painel de marca sofisticado à
 * esquerda (telas grandes) e o formulário à direita, com o portal sinalizado.
 */
export function AuthSplitLayout({
  bannerTitulo = "Sua operação de crédito imobiliário, organizada.",
  bannerSubtitulo = "Uma plataforma completa para conduzir cada negócio do início ao fim.",
  portalNome = "Portal do Correspondente",
  portalDescricao,
  destaques = DESTAQUES_PADRAO,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — visível em telas grandes. */}
      <aside className="auth-brand-panel relative hidden flex-col justify-between overflow-hidden p-10 xl:p-14 lg:flex">
        <div className="relative z-10 flex items-center justify-between">
          <Logo variant="light" className="h-10" />
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-primary-foreground/90 backdrop-blur-sm">
            {portalNome}
          </span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight text-primary-foreground xl:text-5xl">
            {bannerTitulo}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-primary-foreground/70">
            {bannerSubtitulo}
          </p>

          <ul className="mt-10 space-y-5">
            {destaques.map((d) => (
              <li key={d.titulo} className="flex items-start gap-4">
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-primary-foreground backdrop-blur-sm">
                  <d.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-primary-foreground">{d.titulo}</p>
                  <p className="text-sm text-primary-foreground/65">{d.descricao}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} Agilliza · Crédito imobiliário
        </p>
      </aside>

      {/* Formulário. */}
      <main className="flex flex-col bg-muted px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          {/* Marca do portal no topo em telas pequenas (painel oculto). */}
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground lg:hidden">
            {portalNome}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-4 text-center">
              <Logo variant="dark" className="h-11 lg:hidden" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {portalNome}
                </p>
                {portalDescricao && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{portalDescricao}</p>
                )}
              </div>
            </div>

            <div className="auth-form-card rounded-2xl border border-border p-6 sm:p-8">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
