import { createFileRoute } from "@tanstack/react-router";
import { FinanceiroImobMatchTela } from "@/components/imobmatch-gestao/financeiro";
import { assertModuloPermitido } from "@/lib/route-guards";

/** ImobMatch Gestão › Financeiro (ver `components/imobmatch-gestao/financeiro.tsx`). */
export const Route = createFileRoute("/_authenticated/imobmatch/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — ImobMatch Gestão — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("imobmatch.financeiro"),
  component: FinanceiroImobMatchTela,
});
