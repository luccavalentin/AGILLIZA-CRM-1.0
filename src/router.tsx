import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  // Dados de referência que raramente mudam mas são consultados em muitas telas:
  // cache mais longo evita refetch repetido durante a navegação.
  const REFERENCIA_STALE = 10 * 60_000; // 10 min
  const chavesReferencia = [
    ["minha-sessao"],
    ["pipeline-stages"],
    ["chat-etiquetas"],
    ["admin-config-modulos"],
    ["admin-bancos"],
    ["admin-comissoes-bancos"],
    ["admin-parametros"],
    ["admin-sla"],
    ["admin-feriados"],
  ];
  for (const key of chavesReferencia) {
    queryClient.setQueryDefaults(key, { staleTime: REFERENCIA_STALE, gcTime: 15 * 60_000 });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
