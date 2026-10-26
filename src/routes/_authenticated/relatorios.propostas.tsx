import { createFileRoute, redirect } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { buscaDaListaDeOrigem } from "@/lib/relatorios/ecossistema";

// O relatório de propostas saiu (C47): cada número do relatório gerencial e do Painel geral
// leva à lista de propostas, com o mesmo recorte, período e situação.
export const Route = createFileRoute("/_authenticated/relatorios/propostas")({
  beforeLoad: async ({ search }) => {
    await assertModuloPermitido("relatorios.geral");
    throw redirect({
      to: "/operacional/propostas",
      search: buscaDaListaDeOrigem(search as Record<string, unknown>, "propostas") as never,
      replace: true,
    });
  },
});
