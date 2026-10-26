import { createFileRoute } from "@tanstack/react-router";
import { PlanosImobMatchTela } from "@/components/imobmatch-gestao/planos";
import { assertModuloPermitido } from "@/lib/route-guards";

/** ImobMatch Gestão › Planos e preços (ver `components/imobmatch-gestao/planos.tsx`). */
export const Route = createFileRoute("/_authenticated/imobmatch/planos")({
  head: () => ({ meta: [{ title: "Planos e preços — ImobMatch Gestão — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("imobmatch.planos"),
  component: PlanosImobMatchTela,
});
