import { Link } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeft, LogOut, UserRound, Lock, Bell } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "./global-search";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { AppBreadcrumbs } from "./app-breadcrumbs";
import type { NavGroup } from "./nav-config";

export interface ShellUser {
  id: string;
  nome: string | null;
  email: string | null;
  /** Foto de perfil enviada pelo usuário (exibida em todo o sistema). */
  foto_url?: string | null;
}

interface TopbarProps {
  nav: NavGroup[];
  user: ShellUser;
  collapsed: boolean;
  showAccountMenu: boolean;
  showSearch: boolean;
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
  onSignOut: () => void;
}

function iniciais(nome: string | null, email: string | null): string {
  const base = (nome ?? email ?? "?").trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function Topbar({
  nav,
  user,
  collapsed,
  showAccountMenu,
  showSearch,
  onToggleMobile,
  onToggleCollapse,
  onSignOut,
}: TopbarProps) {

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-16 items-center gap-1 border-b border-border bg-background/85 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:gap-2 sm:px-4"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 lg:hidden"
        aria-label="Abrir menu de navegação"
        onClick={onToggleMobile}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden h-10 w-10 shrink-0 lg:inline-flex"
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        aria-pressed={collapsed}
        onClick={onToggleCollapse}
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>

      {/* Marca no mobile (drawer some da view) */}
      <Link
        to={"/dashboard" as string}
        aria-label="Ir para o início"
        className="ml-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Logo variant="dark" className="h-6" />
      </Link>

      <div className="mx-1 hidden min-w-0 lg:block">
        <AppBreadcrumbs nav={nav} />
      </div>


      <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
        {showSearch && <GlobalSearch />}
        <ThemeToggle />
        <NotificationsBell userId={user.id} />

        {showAccountMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10"
                aria-label="Menu da conta"
              >
                <Avatar className="h-8 w-8">
                  {user.foto_url && (
                    <AvatarImage src={user.foto_url} alt={user.nome ?? "Foto do usuário"} />
                  )}
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {iniciais(user.nome, user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate text-sm font-medium">{user.nome ?? "Usuário"}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={"/conta/perfil" as string}>
                  <UserRound className="mr-2 h-4 w-4" /> Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={"/conta/seguranca" as string}>
                  <Lock className="mr-2 h-4 w-4" /> Segurança
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={"/conta/notificacoes" as string}>
                  <Bell className="mr-2 h-4 w-4" /> Notificações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
