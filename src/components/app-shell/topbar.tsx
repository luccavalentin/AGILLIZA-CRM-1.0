import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, PanelLeftClose, PanelLeft, LogOut, UserRound, Lock, Bell } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  showAccountMenu,
  showSearch,
  onToggleMobile,
  onToggleCollapse,
  onSignOut,
}: TopbarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Abrir menu"
        onClick={onToggleMobile}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        aria-label="Recolher menu"
        onClick={onToggleCollapse}
      >
        <PanelLeft className="h-5 w-5" />
      </Button>

      <div className="mx-1 hidden lg:block">
        <AppBreadcrumbs nav={nav} />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {showSearch && <GlobalSearch />}
        <ThemeToggle />
        <NotificationsBell userId={user.id} />

        {showAccountMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Menu da conta"
              >
                <Avatar className="h-8 w-8">
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
              <DropdownMenuItem onClick={() => navigate({ to: "/admin/notificacoes" as string })}>
                <Bell className="mr-2 h-4 w-4" /> Notificações
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
