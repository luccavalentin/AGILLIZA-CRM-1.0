import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormulariosView } from "@/components/formularios/formularios-view";
import { PapelTimbradoView } from "@/components/formularios/papel-timbrado-view";
import { BANCOS_FORMULARIO, type BancoFormulario } from "@/lib/formularios/formularios.functions";

export const Route = createFileRoute("/_authenticated/formularios/$banco")({
  head: () => ({ meta: [{ title: "Formulários — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const { banco } = Route.useParams();
  if (banco === "papel-timbrado") return <PapelTimbradoView />;
  if (!BANCOS_FORMULARIO.includes(banco as BancoFormulario)) throw notFound();
  return <FormulariosView banco={banco as BancoFormulario} />;
}
