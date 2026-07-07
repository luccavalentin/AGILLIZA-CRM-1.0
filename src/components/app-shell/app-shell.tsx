import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import symbolLight from "@/assets/brand/agilliza-symbol-oficial-light.png";
import { SidebarNav, SidebarRail } from "./sidebar-nav";
import { Topbar, type ShellUser } from "./topbar";
import type { NavGroup } from "./nav-config";

const STORAGE_KEY = "agilliza-sidebar-collapsed";

export interface AppShellProps {
  nav: NavGroup[];
  user: ShellUser;
  showAccountMenu?: boolean;
  showSearch?: boolean;
  onSignOut: () => void;
  children: ReactNode;
}

function BrandSymbol() {
  return <img src={symbolLight} alt="Agilliza" className="h-7 w-auto" />;
}

export function AppShell({
  nav,
  user,
  showAccountMenu = true,
  showSearch = true,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Estado colapsado NÃO renderiza no SSR — hidratado por useEffect.
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

  const larguraDesktop = hydrated && collapsed ? "lg:w-14" : "lg:w-64";

  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

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
              hydrated && collapsed ? "justify-center px-2" : "px-4",
            )}
          >
            <Link to={"/dashboard" as string} aria-label="Ir para o início">
              {hydrated && collapsed ? <BrandSymbol /> : <Logo variant="light" className="h-7" />}
            </Link>
          </div>
          <div className="sidebar-scroll flex-1 overflow-y-auto">
            {hydrated && collapsed ? <SidebarRail nav={nav} /> : <SidebarNav nav={nav} />}
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
              <SidebarNav nav={nav} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Coluna principal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            nav={nav}
            user={user}
            collapsed={hydrated && collapsed}
            showAccountMenu={showAccountMenu}
            showSearch={showSearch}
            onToggleMobile={() => setMobileOpen(true)}
            onToggleCollapse={toggleCollapse}
            onSignOut={onSignOut}
          />
          <main id="conteudo-principal" className="flex-1 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
