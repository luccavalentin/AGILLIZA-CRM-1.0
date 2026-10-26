import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesImobMatchTela } from "@/components/imobmatch-gestao/configuracoes";
import { assertModuloPermitido } from "@/lib/route-guards";

/** ImobMatch Gestão › Configurações (ver `components/imobmatch-gestao/configuracoes.tsx`). */
export const Route = createFileRoute("/_authenticated/imobmatch/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ImobMatch Gestão — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("imobmatch.config"),
  component: ConfiguracoesImobMatchTela,
});
