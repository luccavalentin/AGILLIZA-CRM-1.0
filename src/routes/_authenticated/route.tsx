import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell/app-shell";
import { Logo } from "@/components/brand/Logo";
import { navInterno, navParceiro } from "@/components/app-shell/nav-config";
import type { NavGroup } from "@/components/app-shell/nav-config";
import { filterNavByPermissions, permsToSet } from "@/components/app-shell/filter-nav";
import { SidebarSkeleton } from "@/components/app-shell/sidebar-nav";
import { getMinhaSessao } from "@/lib/session.functions";
import { getMinhasPermissoes } from "@/lib/permissions.functions";
import { limparCachePermissoes } from "@/lib/route-guards";
import { listarPastasRaiz } from "@/lib/documentos/arquivos.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Agilliza" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/app/apple-touch-icon.png" },
    ],
  }),
  beforeLoad: async () => {
    // getSession() lê a sessão localmente (sem round-trip de rede a cada
    // navegação), evitando lag ao trocar de tela. getUser() só valida no
    // servidor e era chamado em toda navegação — causa da lentidão.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: InternalLayout,
});

function InternalLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [carregamentoTravado, setCarregamentoTravado] = useState(false);

  // Sessão e matriz de permissões mudam raramente (login / edição de acessos).
  // Cache longo (5 min) evita refetch da matriz — que passa por RLS pesada —
  // a cada navegação entre telas.
  const sessaoQuery = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
    retry: 2,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 4000),
    staleTime: 5 * 60_000,
  });
  const permsQuery = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    retry: 2,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 4000),
    staleTime: 5 * 60_000,
  });

  const ehParceiro = sessaoQuery.data?.profile?.acesso_tipo === "portal_parceiro";

  const navFiltrada = useMemo(() => {
    if (!permsQuery.data) return [];
    const base = ehParceiro ? navParceiro : navInterno;
    return filterNavByPermissions(base, permsToSet(permsQuery.data), permsQuery.data.todas);
  }, [permsQuery.data, ehParceiro]);

  const fnPastasRaiz = useServerFn(listarPastasRaiz);
  const pastasQuery = useQuery({
    queryKey: ["nav-pastas-documentos"],
    queryFn: () => fnPastasRaiz(),
    enabled: !!permsQuery.data && !ehParceiro,
    staleTime: 5 * 60_000,
  });

  // Injeta as pastas raiz de Documentos como submenus do item "Arquivos".
  // Feito de forma imutável (novos objetos) para nunca mutar a config de
  // módulo — mutar geraria itens duplicados a cada renderização.
  const navComPastas = useMemo<NavGroup[]>(() => {
    const pastas = pastasQuery.data ?? [];
    if (pastas.length === 0) return navFiltrada;
    return navFiltrada.map((grupo) => ({
      ...grupo,
      items: grupo.items.map((item) => {
        if (item.to !== "/documentos") return item;
        return {
          ...item,
          children: [
            {
              label: "Todos os arquivos",
              icon: item.icon,
              to: "/documentos",
              perm: item.perm,
            },
            ...pastas.map((p) => ({
              label: p.nome,
              icon: Folder,
              to: "/documentos",
              search: { pasta: p.id },
              perm: item.perm,
            })),
          ],
        };
      }),
    }));
  }, [navFiltrada, pastasQuery.data]);


  useEffect(() => {
    if (!sessaoQuery.isLoading && !permsQuery.isLoading) {
      setCarregamentoTravado(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCarregamentoTravado(true);
    }, 8_000);

    return () => window.clearTimeout(timer);
  }, [permsQuery.isLoading, sessaoQuery.isLoading]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    limparCachePermissoes();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const carregando = sessaoQuery.isLoading || permsQuery.isLoading;
  const comErro = sessaoQuery.isError || permsQuery.isError || carregamentoTravado;

  if (comErro) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-muted/40 p-6 text-center">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            Não foi possível carregar sua sessão.
          </p>
          <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setCarregamentoTravado(false);
              sessaoQuery.refetch();
              permsQuery.refetch();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar novamente
          </button>
          <button
            onClick={sair}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (carregando || !sessaoQuery.data || !permsQuery.data) {
    return (
      <div className="flex min-h-[100dvh] w-full bg-muted/40">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <div className="flex h-16 items-center border-b border-sidebar-border px-4">
            <Logo variant="light" className="h-7" />
          </div>
          <SidebarSkeleton />
        </aside>
        <div className="flex flex-1 flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-border bg-background px-6">
            <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
            <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="space-y-4 p-6">
            <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const profile = sessaoQuery.data.profile;

  return (
    <AppShell
      nav={navComPastas}
      user={{
        id: profile?.id ?? "",
        nome: profile?.nome ?? null,
        email: profile?.email ?? null,
        foto_url: profile?.foto_url ?? null,
      }}
      onSignOut={sair}
    >
      <Outlet />
    </AppShell>
  );
}
