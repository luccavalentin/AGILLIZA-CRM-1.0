import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, UserRound, Handshake, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LandingFx } from "@/components/brand/LandingFx";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Agilliza — Escolha seu acesso" }, { name: "robots", content: "noindex" }],
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
    destaque: true,
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="mb-10 flex flex-col items-center gap-4 text-center sm:mb-14">
          <Logo variant="light" className="h-14 sm:h-16" />
          <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Bem-vindo à plataforma
          </h1>
          <p className="max-w-md text-base text-primary-foreground/70">
            Selecione como você deseja acessar.
          </p>
        </div>

        <div className="grid w-full gap-5 sm:grid-cols-3 sm:gap-6">
          {CARDS.map(({ to, titulo, subtitulo, icon: Icon, destaque }) => (
            <Link key={to} to={to} className="group focus-visible:outline-none">
              <Card
                className={
                  "landing-card relative flex h-full flex-col items-start gap-5 overflow-hidden border p-7 text-left group-focus-visible:ring-2 group-focus-visible:ring-white/40 sm:p-8 " +
                  (destaque ? "landing-card-destaque" : "")
                }
              >
                {destaque && (
                  <span className="absolute right-5 top-5 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-destructive-foreground/80">
                    Cliente
                  </span>
                )}
                <span
                  className={
                    "landing-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-full " +
                    (destaque ? "landing-icon-destaque" : "")
                  }
                >
                  <Icon strokeWidth={1.5} className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-[1.4rem]">
                    {titulo}
                  </h2>
                  <p className="mt-1.5 text-sm text-primary-foreground/60">{subtitulo}</p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 border-t border-white/10 pt-4 text-sm font-medium text-primary-foreground/75 transition-colors group-hover:text-primary-foreground">
                  Acessar
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-primary-foreground/45">
        © {new Date().getFullYear()} Agilliza — Crédito Imobiliário. Todos os direitos reservados.
      </footer>
    </div>
  );
}
