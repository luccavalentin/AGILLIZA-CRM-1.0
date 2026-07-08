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
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Logo variant="light" className="h-11" />
          <p className="max-w-sm text-sm text-primary-foreground/70">
            Selecione como você deseja acessar a plataforma.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-4">
          {CARDS.map(({ to, titulo, subtitulo, icon: Icon, destaque }) => (
            <Link key={to} to={to} className="group focus-visible:outline-none">
              <Card className="landing-card flex items-center gap-4 border p-5 group-focus-visible:ring-2 group-focus-visible:ring-white/40">
                <span
                  className={
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl " +
                    (destaque
                      ? "bg-destructive/20 text-destructive-foreground"
                      : "bg-white/10 text-primary-foreground")
                  }
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-primary-foreground">{titulo}</h2>
                  <p className="text-sm text-primary-foreground/60">{subtitulo}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-primary-foreground/50 transition-transform group-hover:translate-x-1" />
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
