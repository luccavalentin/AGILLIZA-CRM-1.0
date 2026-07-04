import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell/app-shell";
import { navInterno } from "@/components/app-shell/nav-config";
import { filterNavByPermissions, permsToSet } from "@/components/app-shell/filter-nav";
import { SidebarSkeleton } from "@/components/app-shell/sidebar-nav";
import { getMinhaSessao } from "@/lib/session.functions";
import { getMinhasPermissoes } from "@/lib/permissions.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: InternalLayout,
});

function InternalLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessaoQuery = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => getMinhaSessao(),
    retry: 1,
    staleTime: 60_000,
  });
  const permsQuery = useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: () => getMinhasPermissoes(),
    retry: 1,
    staleTime: 60_000,
  });

  const navFiltrada = useMemo(() => {
    if (!permsQuery.data) return [];
    return filterNavByPermissions(
      navInterno,
      permsToSet(permsQuery.data),
      permsQuery.data.todas,
    );
  }, [permsQuery.data]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const carregando = sessaoQuery.isLoading || permsQuery.isLoading;
  const comErro = sessaoQuery.isError || permsQuery.isError;

  if (comErro) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-muted/40 p-6 text-center">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            Não foi possível carregar sua sessão.
          </p>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
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
          <div className="h-16 border-b border-sidebar-border" />
          <SidebarSkeleton />
        </aside>
        <div className="flex-1">
          <div className="h-16 border-b border-border bg-background" />
          <div className="p-6">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const profile = sessaoQuery.data.profile;

  return (
    <AppShell
      nav={navFiltrada}
      user={{
        id: profile?.id ?? "",
        nome: profile?.nome ?? null,
        email: profile?.email ?? null,
      }}
      onSignOut={sair}
    >
      <Outlet />
    </AppShell>
  );
}
