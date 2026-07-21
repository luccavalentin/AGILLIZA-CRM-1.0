import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
  PanelLeft,
  PanelLeftClose,
  LogOut,
  UserRound,
  Bell,
  Gauge,
  ListChecks,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import symbolLight from "@/assets/brand/agilliza-symbol-oficial-light.png";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import {
  clienteListarNotificacoes,
  clienteListarAtendentes,
} from "@/lib/portal/cliente.functions";
import { ClienteChatWatcher } from "@/components/cliente/cliente-chat-watcher";
import { ClienteChatFlutuante } from "@/components/cliente/cliente-chat-flutuante";
import { cn } from "@/lib/utils";


const STORAGE_KEY = "agilliza-cliente-sidebar-collapsed";

interface NavItemCliente {
  label: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, unknown>;
  /** Marca o item que exibe o indicador piscante de mensagens novas. */
  chat?: boolean;
}

const NAV_CLIENTE: { id: string; label: string; items: NavItemCliente[] }[] = [
  {
    id: "meu-financiamento",
    label: "Meu Financiamento",
    items: [
      { label: "Início", icon: Gauge, to: "/cliente/visao-geral" },
      { label: "Acompanhar", icon: ListChecks, to: "/cliente/acompanhar-minha-proposta" },
      {
        label: "Conversar",
        icon: MessageCircle,
        to: "/cliente/chat",
        chat: true,
      },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    items: [{ label: "Meu perfil", icon: UserRound, to: "/cliente/perfil" }],
  },
];

/** Conta mensagens da equipe ainda não lidas pelo cliente (todas as threads). */
function useChatNaoLidas() {
  const { data } = useQuery({
    queryKey: ["cliente", "atendentes"],
    queryFn: () => clienteListarAtendentes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 8000),
  });
  return (data ?? []).reduce((acc, a) => acc + (a.nao_lidas ?? 0), 0);
}


export interface ClienteShellUser {
  nome: string;
  foto_url: string | null;
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function BrandSymbol() {
  return <img src={symbolLight} alt="Agilliza" className="h-7 w-auto" />;
}

function SidebarLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ativo = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const chatNaoLidas = useChatNaoLidas();

  if (collapsed) {
    return (
      <nav aria-label="Navegação principal" className="flex flex-col items-center gap-1 px-2 py-4">
        {NAV_CLIENTE.flatMap((g) => g.items).map((item) => {
          const Icon = item.icon;
          const active = ativo(item.to);
          const piscando = !!item.chat && chatNaoLidas > 0;
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  search={item.search as never}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-primary hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    piscando && "animate-pulse",
                  )}

                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
                  )}
                  <Icon className="h-[18px] w-[18px]" />
                  {piscando && (
                    <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4 px-3 py-4">
      {NAV_CLIENTE.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = ativo(item.to);
            const piscando = !!item.chat && chatNaoLidas > 0;
            return (
              <Link
                key={item.label}
                to={item.to}
                search={item.search as never}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  piscando && !active && "animate-pulse",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-sidebar-accent-foreground" : "text-sidebar-primary",
                  )}
                />

                <span className="truncate">{item.label}</span>
                {piscando && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {chatNaoLidas > 9 ? "9+" : chatNaoLidas}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}


function NotificacoesBell() {
  const { data: notificacoes } = useQuery({
    queryKey: ["cliente", "notificacoes"],
    queryFn: () => clienteListarNotificacoes(),
    refetchInterval: (q: any) => (q.state.status === "error" ? false : 20000),
  });
  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
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
            <div key={n.id} className={cn("rounded-md px-2 py-2 text-sm", !n.lida && "bg-accent")}>
              <p className="font-medium text-foreground">{n.titulo}</p>
              {n.corpo && <p className="text-muted-foreground">{n.corpo}</p>}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClienteShell({
  user,
  onSignOut,
  children,
}: {
  user: ClienteShellUser;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const isCollapsed = hydrated && collapsed;
  const larguraDesktop = isCollapsed ? "lg:w-14" : "lg:w-64";

  return (
    <TooltipProvider delayDuration={200}>
      <ClienteChatWatcher />
      <div className="flex min-h-[100dvh] w-full bg-muted/40">

        {/* Sidebar desktop */}
        <aside
          className={cn(
            "app-sidebar sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-200 lg:flex",
            larguraDesktop,
          )}
        >
          <div
            className={cn(
              "flex h-16 items-center border-b border-sidebar-border",
              isCollapsed ? "justify-center px-2" : "px-4",
            )}
          >
            <Link to="/cliente/visao-geral" aria-label="Ir para o início">
              {isCollapsed ? <BrandSymbol /> : <Logo variant="light" className="h-7" />}
            </Link>
          </div>
          <div className="sidebar-scroll flex-1 overflow-y-auto">
            <SidebarLinks collapsed={isCollapsed} />
          </div>
        </aside>

        {/* Drawer mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="app-sidebar w-72 border-sidebar-border p-0 text-sidebar-foreground"
          >
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <div className="flex h-16 items-center border-b border-sidebar-border px-4">
              <Logo variant="light" className="h-7" />
            </div>
            <div className="sidebar-scroll h-[calc(100dvh-4rem)] overflow-y-auto">
              <SidebarLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Coluna principal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 lg:hidden"
              aria-label="Abrir menu de navegação"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              aria-pressed={isCollapsed}
              onClick={toggleCollapse}
            >
              {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>

            <Link to="/cliente/visao-geral" aria-label="Ir para o início" className="lg:hidden">
              <Logo variant="dark" className="h-6" />
            </Link>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <NotificacoesBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu da conta">
                    <Avatar className="h-8 w-8">
                      {user.foto_url ? <AvatarImage src={user.foto_url} alt={user.nome} /> : null}
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {iniciais(user.nome)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="truncate text-sm font-medium">{user.nome}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      Meu Financiamento
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/cliente/perfil" })}>
                    <UserRound className="mr-2 h-4 w-4" /> Meu perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-2 sm:p-3 lg:p-4">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>

          <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
            <Link to="/cliente/perfil" className="underline underline-offset-2">
              Privacidade e meus dados (LGPD)
            </Link>
          </footer>
        </div>
      </div>
      <ClienteChatFlutuante />

    </TooltipProvider>
  );
}
