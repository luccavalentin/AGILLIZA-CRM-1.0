import { createFileRoute, redirect } from "@tanstack/react-router";
import { VisaoGeralImobMatch } from "@/components/imobmatch-gestao/visao-geral";
import { moduloPermitido } from "@/lib/route-guards";

const algum = async (modulos: string[]) => {
  for (const m of modulos) if (await moduloPermitido(m)) return true;
  return false;
};

/**
 * ImobMatch Gestão › Visão geral. Quem não vê os números (nem o financeiro) vai direto para
 * a primeira tela do ImobMatch que pode abrir.
 */
export const Route = createFileRoute("/_authenticated/imobmatch/")({
  head: () => ({ meta: [{ title: "Visão geral — ImobMatch Gestão — Agilliza" }] }),
  beforeLoad: async () => {
    if (await algum(["imobmatch.visao", "imobmatch.financeiro"])) return;
    if (await algum(["imobmatch.moderacao", "saas.imobmatch"]))
      throw redirect({ to: "/imobmatch/moderacao" });
    if (await algum(["saas.patrocinados"])) throw redirect({ to: "/imobmatch/patrocinados" });
    if (await algum(["imobmatch.planos"])) throw redirect({ to: "/imobmatch/planos" });
    if (await algum(["imobmatch.config"])) throw redirect({ to: "/imobmatch/configuracoes" });
    throw redirect({ to: "/dashboard" });
  },
  component: VisaoGeralImobMatch,
});
