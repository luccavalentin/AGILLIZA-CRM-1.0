import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { usePermissao } from "@/hooks/use-permissao";
import { buscarContasDoFiltro } from "@/lib/plataforma/filtro-base.functions";
import {
  alvoDoFiltro,
  FILTRO_PADRAO,
  lerFiltroBase,
  paramsDoFiltro,
  type AlvoDoFiltro,
  type ContaFiltro,
  type FiltroBase,
} from "@/lib/plataforma/filtro-base";

const CHAVES = ["base", "origem", "conta"] as const;

export interface UsoFiltroBase {
  /** Pode ver contas do Agilliza Tech (`saas.contas`). Sem isso, a tela é só a base do Agilliza. */
  pode: boolean;
  filtro: FiltroBase;
  definir: (f: FiltroBase) => void;
  /** O que a tela deve buscar (já considera a permissão). */
  alvo: AlvoDoFiltro;
  /** Conta escolhida (resolvida pelo id da URL). */
  conta: ContaFiltro | null;
  /** Quantas contas vinculadas existem (para mostrar ou não a seção "vinculados"). */
  totalVinculadas: number;
}

/**
 * Estado do filtro "Sua base" | "Assinantes" na URL da tela (`?base=`, `?origem=`, `?conta=`).
 * Os demais parâmetros da tela ficam intactos.
 */
export function useFiltroBase(): UsoFiltroBase {
  const pode = usePermissao("saas.contas", "view");
  const router = useRouter();
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const base = search?.base;
  const origem = search?.origem;
  const contaParam = search?.conta;
  const filtro = useMemo(
    () => (pode ? lerFiltroBase({ base, origem, conta: contaParam }) : FILTRO_PADRAO),
    [pode, base, origem, contaParam],
  );

  const definir = useCallback(
    (f: FiltroBase) => {
      const atual = router.state.location;
      const limpo: Record<string, unknown> = { ...(atual.search as Record<string, unknown>) };
      for (const k of CHAVES) delete limpo[k];
      void router.navigate({
        to: atual.pathname,
        search: { ...limpo, ...paramsDoFiltro(f) } as never,
        replace: true,
      } as never);
    },
    [router],
  );

  const buscarFn = useServerFn(buscarContasDoFiltro);
  const contaQ = useQuery({
    queryKey: ["filtro-base-conta", filtro.contaId],
    queryFn: () =>
      buscarFn({
        data: {
          id: filtro.contaId,
          grupo: filtro.base === "assinantes" ? "assinantes" : "vinculados",
          pagina: 1,
          porPagina: 5,
        },
      }),
    enabled: pode && !!filtro.contaId,
    staleTime: 5 * 60_000,
  });
  const vinculadasQ = useQuery({
    queryKey: ["filtro-base-vinculadas"],
    queryFn: () => buscarFn({ data: { grupo: "vinculados", pagina: 1, porPagina: 5 } }),
    enabled: pode,
    staleTime: 5 * 60_000,
  });

  const alvo = useMemo<AlvoDoFiltro>(
    () =>
      pode
        ? alvoDoFiltro(filtro)
        : { agilliza: true, grupo: null, licenca: null, semNoAgilliza: false },
    [pode, filtro],
  );

  return {
    pode,
    filtro,
    definir,
    alvo,
    conta: contaQ.data?.contas?.[0] ?? null,
    totalVinculadas: vinculadasQ.data?.total ?? 0,
  };
}
