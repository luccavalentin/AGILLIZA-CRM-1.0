import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, UserRound, Handshake, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LandingFx } from "@/components/brand/LandingFx";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agilliza — Escolha seu acesso" },
      { name: "robots", content: "noindex" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Agilliza" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/app/apple-touch-icon.png" },
    ],
  }),
  component: Landing,
});

interface AcessoCard {
  to: string;
  titulo: string;
  subtitulo: string;
  icon: typeof Building2;
  destaque?: boolean;
}

const CARDS: AcessoCard[] = [
  {
    to: "/auth",
    titulo: "Correspondente",
    subtitulo: "Acesso interno",
    icon: Building2,
  },
  {
    to: "/portal",
    titulo: "Cliente",
    subtitulo: "Portal do processo",
    icon: UserRound,
  },
  {
    to: "/parceiro",
    titulo: "Parceiro",
    subtitulo: "Portal do parceiro",
    icon: Handshake,
  },
];

function Landing() {
  return (
    <div className="landing-bg flex min-h-[100dvh] flex-col">
      <LandingFx />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12 md:py-16">
        <div className="mb-10 flex flex-col items-center gap-4 text-center sm:mb-14">
          <Logo variant="light" className="h-14 sm:h-16" />
          <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Bem-vindo à plataforma
          </h1>
          <p className="max-w-md text-base text-primary-foreground/70">
            Selecione como você deseja acessar.
          </p>
        </div>

        <div className="grid w-full max-w-md gap-3 sm:max-w-3xl sm:grid-cols-2 md:grid-cols-3 sm:gap-4 md:gap-5">
          {CARDS.map(({ to, titulo, subtitulo, icon: Icon, destaque }) => (
            <Link key={to} to={to} className="group focus-visible:outline-none">
              <Card
                className={
                  "landing-card relative flex h-full items-center gap-4 overflow-hidden border p-4 text-left group-focus-visible:ring-2 group-focus-visible:ring-white/40 sm:flex-col sm:items-start sm:gap-4 sm:p-6 " +
                  (destaque ? "landing-card-destaque" : "")
                }
              >
                {destaque && (
                  <span className="absolute right-4 top-4 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-destructive-foreground/70">
                    Cliente
                  </span>
                )}
                <span
                  className={
                    "landing-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 " +
                    (destaque ? "landing-icon-destaque" : "")
                  }
                >
                  <Icon strokeWidth={1.5} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 sm:mt-1">
                  <h2 className="truncate text-base font-semibold tracking-tight text-primary-foreground sm:text-lg">
                    {titulo}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-primary-foreground/55 sm:text-sm">
                    {subtitulo}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-primary-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary-foreground sm:hidden" />
                <span className="mt-2 hidden items-center gap-1.5 text-sm font-medium text-primary-foreground/75 transition-colors group-hover:text-primary-foreground sm:inline-flex">
                  Acessar
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-primary-foreground">
        © {new Date().getFullYear()} Agilliza — Crédito Imobiliário. Todos os direitos reservados.
      </footer>
    </div>
  );
}
