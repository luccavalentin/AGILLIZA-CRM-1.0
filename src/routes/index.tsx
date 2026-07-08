import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, UserRound, Handshake, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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
                  <span className="absolute right-4 top-4 rounded-full bg-destructive/25 px-3 py-1 text-xs font-semibold text-destructive-foreground">
                    Cliente
                  </span>
                )}
                <span
                  className={
                    "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl " +
                    (destaque
                      ? "bg-destructive/25 text-destructive-foreground"
                      : "bg-white/10 text-primary-foreground")
                  }
                >
                  <Icon className="h-8 w-8" />
                </span>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-primary-foreground sm:text-2xl">{titulo}</h2>
                  <p className="mt-1 text-sm text-primary-foreground/65">{subtitulo}</p>
                </div>
                <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground/85 transition-colors group-hover:text-primary-foreground">
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
