import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type { NavGroup } from "./nav-config";

interface Crumb {
  label: string;
  to?: string;
}

/** Deriva as migalhas de pão a partir do caminho atual e da navegação. */
function derivarCrumbs(nav: NavGroup[], pathname: string): Crumb[] {
  for (const group of nav) {
    for (const item of group.items) {
      const filhos = item.children ?? [];
      for (const child of filhos) {
        if (child.to && (pathname === child.to || pathname.startsWith(child.to + "/"))) {
          return [
            { label: group.label },
            { label: item.label },
            { label: child.label, to: child.to },
          ];
        }
      }
      if (item.to && (pathname === item.to || pathname.startsWith(item.to + "/"))) {
        return [{ label: group.label }, { label: item.label, to: item.to }];
      }
    }
  }
  return [{ label: "Início" }];
}

export function AppBreadcrumbs({ nav }: { nav: NavGroup[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = derivarCrumbs(nav, pathname);

  return (
    <nav aria-label="Trilha de navegação" className="hidden items-center gap-1 text-sm md:flex">
      {crumbs.map((c, i) => {
        const ultimo = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
            {c.to && !ultimo ? (
              <Link to={c.to as string} className="text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={ultimo ? "font-medium text-foreground" : "text-muted-foreground"}>
                {c.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
