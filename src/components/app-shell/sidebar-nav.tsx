import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChatFlash, stopFlash } from "@/components/chat/chat-alerta";
import type { NavGroup, NavItem } from "./nav-config";

const ROTAS_CHAT = ["/crm/chat"];
const ehRotaChat = (to?: string | null) => !!to && ROTAS_CHAT.includes(to);

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** Pasta atualmente selecionada (query `?pasta=`), quando houver. */
function useActivePasta() {
  return useRouterState({
    select: (s) => (s.location.search as { pasta?: string })?.pasta,
  });
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

function itemAtivo(item: NavItem, melhor: string | null, pasta?: string): boolean {
  // Grupo com destino próprio (menu novo de 26/10: "Visão geral ao vivo" > Operação,
  // Servidor...) é ativo quando QUALQUER filho é: antes o `to` do pai decidia sozinho e
  // o grupo abria fechado em /tecnologia/erros.
  if (item.children && item.children.length > 0) {
    return item.children.some((c) => itemAtivo(c, melhor, pasta));
  }
  if (item.to) {
    if (item.to !== melhor) return false;
    // Itens irmãos que compartilham o mesmo `to` mas apontam para pastas
    // diferentes (ex.: subpastas de Documentos) são desambiguados pelo
    // parâmetro `?pasta=`: cada um só fica ativo quando sua pasta é a atual.
    const pastaItem = item.search?.pasta;
    if (pastaItem !== undefined) return pastaItem === pasta;
    // Item sem pasta (ex.: "Todos os arquivos") só é ativo sem pasta selecionada.
    if (pasta !== undefined) return false;
    return true;
  }
  return false;
}

interface SidebarProps {
  nav: NavGroup[];
  onNavigate?: () => void;
}

/** Sidebar completa (desktop expandida / drawer mobile). */
export function SidebarNav({ nav, onNavigate }: SidebarProps) {
  const pathname = useActivePath();
  const pasta = useActivePasta();
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
                pasta={pasta}
                onNavigate={onNavigate}
              />
            ) : (
              <SidebarLink
                key={item.label}
                item={item}
                active={itemAtivo(item, melhor, pasta)}
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
  filho,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  /** Item dentro de um grupo: insígnia menor (24 px). */
  filho?: boolean;
}) {
  const Icon = item.icon;
  const flash = useChatFlash();
  const isChat = ehRotaChat(item.to);
  const piscar = isChat && flash && !active;

  useEffect(() => {
    if (isChat && active) stopFlash();
  }, [isChat, active]);

  return (
    <Link
      to={item.to as string}
      // `params` faltava aqui: os itens de checklist apontam para
      // `/checklists/$id` e o link saía com `$id` sem valor, levando a
      // /checklists/undefined — 404 em todos eles.
      params={(item.params ?? undefined) as never}
      search={(item.search ?? undefined) as never}
      onClick={() => {
        if (isChat) stopFlash();
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-white/15 hover:text-sidebar-foreground",
        piscar && "animate-piscar-chat",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
      )}
      {/* Insígnia 3D (C00, 26/10): o glifo mora num quadrado com véu e fio de luz; o
          ativo vira peça branca em relevo com o glifo azul (CSS em styles.css). */}
      <span className={cn("menu-insignia", filho && "filho")} aria-hidden>
        <Icon />
      </span>
      <span className="truncate">{item.label}</span>
      {piscar && (
        <span className="ml-auto h-2.5 w-2.5 shrink-0 animate-ping rounded-full bg-white shadow-[0_0_8px_white]" />
      )}
      {item.badge && !piscar && (
        <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">
          {item.badge}
        </span>
      )}
      {item.emBreve && <span className="selo-em-breve">Em breve</span>}
    </Link>
  );
}

function CollapsibleGroup({
  item,
  melhor,
  pasta,
  onNavigate,
}: {
  item: NavItem;
  melhor: string | null;
  pasta?: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const algumAtivo = itemAtivo(item, melhor, pasta);
  return (
    <Collapsible defaultOpen={algumAtivo}>
      <CollapsibleTrigger
        // Sem o relevo genérico de botão (styles.css, "3D Depth System"): no menu ele
        // desenhava uma caixa em volta só dos itens com submenu.
        data-depth="off"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "[&[data-state=open]>svg:last-child]:rotate-90",
        )}
      >
        <span className={cn("menu-insignia", algumAtivo && "contem-ativo")} aria-hidden>
          <Icon />
        </span>
        <span className="truncate">{item.label}</span>
        <ChevronRight className="ml-auto h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-[21px] mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
        {item.children!.map((child) => (
          <SidebarLink
            key={child.label}
            item={child}
            active={itemAtivo(child, melhor, pasta)}
            onNavigate={onNavigate}
            filho
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Sidebar colapsada: apenas ícones com tooltip. */
export function SidebarRail({ nav, onNavigate }: SidebarProps) {
  const pathname = useActivePath();
  const pasta = useActivePasta();
  const melhor = melhorDestino(nav, pathname);
  const flash = useChatFlash();
  const itens = nav.flatMap((g) => g.items);

  return (
    <nav aria-label="Navegação principal" className="flex flex-col items-center gap-1 px-2 py-4">
      {itens.map((item) => {
        const Icon = item.icon;
        const active = itemAtivo(item, melhor, pasta);
        const to = item.to ?? item.children?.[0]?.to;
        // Rota com parâmetro (`/checklists/$id`) precisa dos params do próprio
        // item ou, quando o item é só um agrupador, os do primeiro filho.
        const params = item.to ? item.params : (item.params ?? item.children?.[0]?.params);
        const search = item.to ? item.search : (item.search ?? item.children?.[0]?.search);
        const isChat = ehRotaChat(to) || ehRotaChat(item.to);
        const piscar = isChat && flash && !active;
        return (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Link
                to={to as string}
                params={(params ?? undefined) as never}
                search={(search ?? undefined) as never}
                onClick={() => {
                  if (isChat) stopFlash();
                  onNavigate?.();
                }}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-primary hover:bg-white/15 hover:text-sidebar-foreground",
                  piscar && "animate-piscar-chat",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary" />
                )}
                <span className="menu-insignia" aria-hidden>
                  <Icon />
                </span>
                {piscar && (
                  <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-sidebar-primary" />
                )}
                {item.emBreve && (
                  <span className="selo-em-breve-ponto absolute right-1 top-1" aria-hidden />
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

/** Skeleton exibido enquanto as permissões carregam (evita flash/salto). */
export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-sidebar-foreground/10" />
      ))}
    </div>
  );
}
