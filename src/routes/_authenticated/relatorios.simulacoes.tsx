import { createFileRoute, redirect } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { buscaDaListaDeOrigem } from "@/lib/relatorios/ecossistema";

// O relatório de simulações saiu (C47): cada número do relatório gerencial e do Painel geral
// leva à lista de simulações, com o mesmo recorte e período.
export const Route = createFileRoute("/_authenticated/relatorios/simulacoes")({
  beforeLoad: async ({ search }) => {
    await assertModuloPermitido("relatorios.geral");
    throw redirect({
      to: "/operacional/simulacoes",
      search: buscaDaListaDeOrigem(search as Record<string, unknown>, "simulacoes") as never,
      replace: true,
    });
  },
});
