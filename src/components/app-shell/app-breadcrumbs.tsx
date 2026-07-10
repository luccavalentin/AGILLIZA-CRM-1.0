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
    // Primeira rota disponível do grupo (para tornar o grupo clicável).
    const rotaDoGrupo =
      group.items.find((it) => it.to)?.to ??
      group.items.flatMap((it) => it.children ?? []).find((c) => c.to)?.to;

    for (const item of group.items) {
      const filhos = item.children ?? [];
      for (const child of filhos) {
        if (child.to && (pathname === child.to || pathname.startsWith(child.to + "/"))) {
          return [
            { label: group.label, to: rotaDoGrupo },
            { label: item.label, to: item.to ?? child.to },
            { label: child.label, to: child.to },
          ];
        }
      }
      if (item.to && (pathname === item.to || pathname.startsWith(item.to + "/"))) {
        return [
          { label: group.label, to: rotaDoGrupo },
          { label: item.label, to: item.to },
        ];
      }
    }
  }
  return [{ label: "Início", to: "/" }];
}


export function AppBreadcrumbs({ nav }: { nav: NavGroup[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = derivarCrumbs(nav, pathname);

  return (
    <nav
      aria-label="Trilha de navegação"
      className="hidden items-center gap-0.5 text-sm md:flex"
    >
      {crumbs.map((c, i) => {
        const ultimo = i === crumbs.length - 1;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && (
              <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            )}
            {c.to && !ultimo ? (
              <Link
                to={c.to as string}
                className="rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={
                  ultimo
                    ? "rounded-md bg-primary/10 px-2 py-1 font-semibold text-foreground ring-1 ring-inset ring-primary/15"
                    : "px-2 py-1 text-muted-foreground"
                }
              >
                {c.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

