import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavGroup, NavItem } from "./nav-config";

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** Coleta todos os destinos (`to`) de folhas da navegação. */
function coletarDestinos(nav: NavGroup[]): string[] {
  const out: string[] = [];
  const visit = (item: NavItem) => {
    if (item.children && item.children.length > 0) item.children.forEach(visit);
    else if (item.to) out.push(item.to);
  };
  nav.forEach((g) => g.items.forEach(visit));
  return out;
}

/**
 * Determina o único destino "vencedor" para o pathname atual: a rota mais
 * específica (mais longa) que casa exatamente ou como prefixo. Evita que itens
 * irmãos cujo `to` é prefixo de outro (ex.: /simulacoes e /simulacoes/nova)
 * fiquem ativos ao mesmo tempo.
 */
function melhorDestino(nav: NavGroup[], pathname: string): string | null {
  let melhor: string | null = null;
  for (const to of coletarDestinos(nav)) {
    if (pathname === to || pathname.startsWith(to + "/")) {
      if (!melhor || to.length > melhor.length) melhor = to;
    }
  }
  return melhor;
}

function itemAtivo(item: NavItem, melhor: string | null): boolean {
  if (item.to) return item.to === melhor;
  if (item.children) return item.children.some((c) => itemAtivo(c, melhor));
  return false;
}

interface SidebarProps {
  nav: NavGroup[];
  onNavigate?: () => void;
}

/** Sidebar completa (desktop expandida / drawer mobile). */
export function SidebarNav({ nav, onNavigate }: SidebarProps) {
  const pathname = useActivePath();
  const melhor = melhorDestino(nav, pathname);

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4 px-3 py-4">
      {nav.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) =>
            item.children && item.children.length > 0 ? (
              <CollapsibleGroup
                key={item.label}
                item={item}
                melhor={melhor}
                onNavigate={onNavigate}
              />
            ) : (
              <SidebarLink
                key={item.label}
                item={item}
                active={itemAtivo(item, melhor)}
                onNavigate={onNavigate}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to as string}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-white/15 hover:text-sidebar-foreground",
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
      {item.badge && (
        <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function CollapsibleGroup({
  item,
  melhor,
  onNavigate,
}: {
  item: NavItem;
  melhor: string | null;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const algumAtivo = itemAtivo(item, melhor);
  return (
    <Collapsible defaultOpen={algumAtivo}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "[&[data-state=open]>svg:last-child]:rotate-90",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 text-sidebar-primary" />
        <span className="truncate">{item.label}</span>
        <ChevronRight className="ml-auto h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-1 flex flex-col gap-1 border-l border-sidebar-border pl-2">
        {item.children!.map((child) => (
          <SidebarLink
            key={child.label}
            item={child}
            active={itemAtivo(child, melhor)}
            onNavigate={onNavigate}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Sidebar colapsada: apenas ícones com tooltip. */
export function SidebarRail({ nav, onNavigate }: SidebarProps) {
  const pathname = useActivePath();
  const itens = nav.flatMap((g) => g.items);

  return (
    <nav aria-label="Navegação principal" className="flex flex-col items-center gap-1 px-2 py-4">
      {itens.map((item) => {
        const Icon = item.icon;
        const active = itemAtivo(item, pathname);
        const to = item.to ?? item.children?.[0]?.to;
        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Link
                to={to as string}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-primary hover:bg-white/15 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
                )}
                <Icon className="h-[18px] w-[18px]" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/** Skeleton exibido enquanto as permissões carregam (evita flash/salto). */
export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-md bg-sidebar-foreground/10"
        />
      ))}
    </div>
  );
}
