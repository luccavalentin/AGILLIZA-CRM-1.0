import { useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
  Link,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, User } from "lucide-react";
import { getSessaoCliente, clienteListarNotificacoes } from "@/lib/portal/cliente.functions";
import { registrarSwCliente } from "@/lib/portal/pwa-cliente";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Meu Financiamento — Agilliza" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#000F9F" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "manifest", href: "/manifest-cliente.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/cliente/apple-touch-icon.png" },
    ],
  }),
  loader: async () => {
    const { cliente } = await getSessaoCliente();
    if (!cliente) throw redirect({ to: "/portal" });
    return { cliente };
  },
  component: ClienteLayout,
});

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ClienteLayout() {
  const { cliente } = Route.useLoaderData();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    registrarSwCliente();
  }, []);

  const { data: notificacoes } = useQuery({
    queryKey: ["cliente", "notificacoes"],
    queryFn: () => clienteListarNotificacoes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 4000),
  });
  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida).length;

  const abas = [
    { to: "/cliente/visao-geral", label: "Início" },
    { to: "/cliente/acompanhar-minha-proposta", label: "Acompanhar" },
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Avatar className="h-10 w-10 rounded-full border border-primary-foreground/20">
            {cliente.foto_url ? <AvatarImage src={cliente.foto_url} alt={cliente.nome} /> : null}
            <AvatarFallback className="bg-primary-foreground/15 text-primary-foreground">
              {iniciais(cliente.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm opacity-90">Olá,</p>
            <p className="truncate font-semibold leading-tight">{cliente.nome}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Notificações"
                className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-primary-foreground/10"
              >
                <Bell className="h-6 w-6" />
                {naoLidas > 0 && (
                  <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                    {naoLidas > 9 ? "9+" : naoLidas}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(notificacoes ?? []).length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma notificação por enquanto.
                </p>
              ) : (
                (notificacoes ?? []).slice(0, 8).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "rounded-md px-2 py-2 text-sm",
                      !n.lida && "bg-accent",
                    )}
                  >
                    <p className="font-medium text-foreground">{n.titulo}</p>
                    {n.corpo && <p className="text-muted-foreground">{n.corpo}</p>}
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-primary-foreground/10"
              >
                <User className="h-6 w-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate({ to: "/cliente/perfil" })}>
                <User className="mr-2 h-4 w-4" /> Meu perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/cliente/logout" })}>
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="mx-auto flex w-full max-w-2xl gap-1 px-2">
          {abas.map((a) => {
            const ativo = pathname.startsWith(a.to);
            return (
              <Link
                key={a.to}
                to={a.to}
                className={cn(
                  "flex-1 rounded-t-md py-2 text-center text-sm font-medium transition-colors",
                  ativo
                    ? "bg-background text-primary"
                    : "text-primary-foreground/80 hover:bg-primary-foreground/10",
                )}
              >
                {a.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <Link to="/cliente/perfil" className="underline underline-offset-2">
          Privacidade e meus dados (LGPD)
        </Link>
      </footer>
    </div>
  );
}
