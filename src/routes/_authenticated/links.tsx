import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { LinksView } from "@/components/links/links-view";

export const Route = createFileRoute("/_authenticated/links")({
  beforeLoad: () => assertModuloPermitido("documentos.links"),
  head: () => ({ meta: [{ title: "Links — Agilliza" }] }),
  component: LinksView,
});
